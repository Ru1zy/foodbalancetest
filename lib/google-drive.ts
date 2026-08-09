import "server-only";

import { google, type drive_v3, type sheets_v4 } from "googleapis";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  decryptGoogleDriveRefreshToken,
  encryptGoogleDriveRefreshToken,
  isGoogleDriveEncryptionConfigured,
} from "@/lib/google-drive-crypto";
import { isValidMonthKey } from "@/lib/sheet-config-validation";

const CONNECTION_ID = "primary";
const ROOT_FOLDER_NAME = "FoodBalance";
const MONTHLY_FOLDER_NAME = "Monthly Orders";
const TEMPLATE_NAME = "FOODBALANCE TEMPLATE";
const TEMPLATE_TAB = "_Template";
const TEMPLATE_PENDING_ROLE = "monthly-template-pending";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

type DriveOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleDriveConnectionStatus = {
  configured: boolean;
  connected: boolean;
  databaseReady: boolean;
  connectedEmail: string | null;
  folderUrl: string | null;
  templateUrl: string | null;
  missingEnvironmentVariables: string[];
  statusError: boolean;
};

export type MonthlySheetProvisionResult =
  | {
      ok: true;
      monthKey: string;
      spreadsheetId: string;
      spreadsheetUrl: string;
      created: boolean;
      recovered: boolean;
    }
  | {
      ok: false;
      monthKey: string;
      code:
        | "invalid_month"
        | "not_configured"
        | "not_connected"
        | "database_not_ready"
        | "token_invalid"
        | "google_error";
      error: string;
    };

function getDriveOAuthConfig(): DriveOAuthConfig {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Drive OAuth environment variables are not configured.");
  }

  try {
    const parsed = new URL(redirectUri);
    const localHttp =
      parsed.protocol === "http:" && parsed.hostname === "localhost";
    if (parsed.protocol !== "https:" && !localHttp) {
      throw new Error("Google Drive OAuth redirect URI must use HTTPS.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("must use HTTPS")) {
      throw error;
    }
    throw new Error("GOOGLE_DRIVE_REDIRECT_URI is not a valid URL.");
  }

  return { clientId, clientSecret, redirectUri };
}

function getMissingEnvironmentVariables(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()) missing.push("GOOGLE_DRIVE_CLIENT_ID");
  if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()) missing.push("GOOGLE_DRIVE_CLIENT_SECRET");
  if (!process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim()) missing.push("GOOGLE_DRIVE_REDIRECT_URI");
  if (!process.env.GOOGLE_CLIENT_EMAIL?.trim()) missing.push("GOOGLE_CLIENT_EMAIL");
  if (!isGoogleDriveEncryptionConfigured()) {
    missing.push("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY");
  }
  return missing;
}

function getSheetsServiceAccountEmail(): string {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  if (!email) {
    throw new Error("GOOGLE_CLIENT_EMAIL is not configured.");
  }
  return email;
}

export function createGoogleDriveOAuthClient() {
  const config = getDriveOAuthConfig();
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

export function buildGoogleDriveAuthorizationUrl(state: string): string {
  return createGoogleDriveOAuthClient().generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent select_account",
    scope: [DRIVE_FILE_SCOPE, EMAIL_SCOPE],
    state,
  });
}

function authorizedOAuthClient(refreshToken: string) {
  const oauth = createGoogleDriveOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return oauth;
}

function driveUrl(fileId: string): string {
  return `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;
}

function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`;
}

function isMissingTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function getGoogleDriveConnectionStatus(): Promise<GoogleDriveConnectionStatus> {
  const missingEnvironmentVariables = getMissingEnvironmentVariables();

  try {
    const connection = await prisma.googleDriveConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: {
        connectedEmail: true,
        folderId: true,
        templateSpreadsheetId: true,
      },
    });

    return {
      configured: missingEnvironmentVariables.length === 0,
      connected: Boolean(connection),
      databaseReady: true,
      connectedEmail: connection?.connectedEmail ?? null,
      folderUrl: connection ? driveUrl(connection.folderId) : null,
      templateUrl: connection
        ? spreadsheetUrl(connection.templateSpreadsheetId)
        : null,
      missingEnvironmentVariables,
      statusError: false,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        configured: missingEnvironmentVariables.length === 0,
        connected: false,
        databaseReady: false,
        connectedEmail: null,
        folderUrl: null,
        templateUrl: null,
        missingEnvironmentVariables,
        statusError: false,
      };
    }

    console.error(
      "Failed to read Google Drive connection status:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      configured: missingEnvironmentVariables.length === 0,
      connected: false,
      databaseReady: true,
      connectedEmail: null,
      folderUrl: null,
      templateUrl: null,
      missingEnvironmentVariables,
      statusError: true,
    };
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findAppFile(
  drive: drive_v3.Drive,
  role: string,
  mimeType: string,
  parentId?: string,
): Promise<string | null> {
  const query = [
    `mimeType = '${escapeDriveQueryValue(mimeType)}'`,
    "trashed = false",
    `appProperties has { key='foodbalanceRole' and value='${escapeDriveQueryValue(role)}' }`,
  ];
  if (parentId) {
    query.push(`'${escapeDriveQueryValue(parentId)}' in parents`);
  }

  const response = await drive.files.list({
    q: query.join(" and "),
    spaces: "drive",
    orderBy: "createdTime desc",
    pageSize: 10,
    fields: "files(id)",
  });

  return response.data.files?.find((file) => Boolean(file.id))?.id ?? null;
}

async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  role: string,
  parentId?: string,
): Promise<string> {
  const folderMimeType = "application/vnd.google-apps.folder";
  const existingId = await findAppFile(drive, role, folderMimeType, parentId);
  if (existingId) return existingId;

  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: folderMimeType,
      parents: parentId ? [parentId] : undefined,
      appProperties: { foodbalanceRole: role },
    },
    fields: "id",
  });

  if (!response.data.id) {
    throw new Error(`Google Drive did not return an ID for folder ${name}.`);
  }
  return response.data.id;
}

async function ensureWriterPermission(
  drive: drive_v3.Drive,
  fileId: string,
  emailAddress: string,
): Promise<void> {
  const permissions = await drive.permissions.list({
    fileId,
    supportsAllDrives: true,
    fields: "permissions(id,type,emailAddress,role)",
  });
  const normalizedEmail = emailAddress.toLowerCase();
  const existingPermission = permissions.data.permissions?.find(
    (permission) =>
      permission.type === "user" &&
      permission.emailAddress?.toLowerCase() === normalizedEmail,
  );
  if (
    existingPermission &&
    ["owner", "organizer", "fileOrganizer", "writer"].includes(
      existingPermission.role || "",
    )
  ) {
    return;
  }

  if (existingPermission?.id) {
    await drive.permissions.update({
      fileId,
      permissionId: existingPermission.id,
      supportsAllDrives: true,
      requestBody: { role: "writer" },
      fields: "id",
    });
    return;
  }

  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    sendNotificationEmail: false,
    requestBody: {
      type: "user",
      role: "writer",
      emailAddress,
    },
    fields: "id",
  });
}

async function initializeTemplateSpreadsheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<void> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetId = metadata.data.sheets?.[0]?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error("New Google spreadsheet has no sheet to initialize.");
  }

  const columnWidths = [55, 150, 110, 220, 120, 110, 420, 90, 300, 90];
  const requests: sheets_v4.Schema$Request[] = [
    // Keep initialization safe to retry if the process stopped after Drive
    // created the file but before both Sheets API calls completed.
    {
      unmergeCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 1,
          endColumnIndex: 11,
        },
      },
    },
    {
      updateSpreadsheetProperties: {
        properties: { locale: "uk_UA", timeZone: "Europe/Kyiv" },
        fields: "locale,timeZone",
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          title: TEMPLATE_TAB,
          gridProperties: { frozenRowCount: 4 },
        },
        fields: "title,gridProperties.frozenRowCount",
      },
    },
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 1,
          endColumnIndex: 11,
        },
        mergeType: "MERGE_ALL",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 1,
          endColumnIndex: 11,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: { bold: true, fontSize: 14 },
          },
        },
        fields:
          "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 3,
          endRowIndex: 4,
          startColumnIndex: 1,
          endColumnIndex: 11,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 },
            },
          },
        },
        fields: "userEnteredFormat",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 4,
          endRowIndex: 1000,
          startColumnIndex: 1,
          endColumnIndex: 11,
        },
        cell: {
          userEnteredFormat: {
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(verticalAlignment,wrapStrategy)",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: 1,
          endIndex: 2,
        },
        properties: { pixelSize: 34 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: 3,
          endIndex: 4,
        },
        properties: { pixelSize: 38 },
        fields: "pixelSize",
      },
    },
    ...columnWidths.map((pixelSize, offset) => ({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: offset + 1,
          endIndex: offset + 2,
        },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    })),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${TEMPLATE_TAB}!B2`,
          values: [["Дата доставки"]],
        },
        {
          range: `${TEMPLATE_TAB}!B4:K4`,
          values: [[
            "№",
            "Ім’я",
            "Телефон",
            "Адреса",
            "Chat ID",
            "Пакет",
            "Страви",
            "Прибори",
            "Коментар",
            "Ціна",
          ]],
        },
      ],
    },
  });
}

async function ensureDriveAssets(refreshToken: string): Promise<{
  folderId: string;
  templateSpreadsheetId: string;
}> {
  const auth = authorizedOAuthClient(refreshToken);
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const rootFolderId = await ensureFolder(
    drive,
    ROOT_FOLDER_NAME,
    "root-folder",
  );
  const folderId = await ensureFolder(
    drive,
    MONTHLY_FOLDER_NAME,
    "monthly-folder",
    rootFolderId,
  );
  await ensureWriterPermission(drive, folderId, getSheetsServiceAccountEmail());

  const spreadsheetMimeType = "application/vnd.google-apps.spreadsheet";
  let templateSpreadsheetId = await findAppFile(
    drive,
    "monthly-template",
    spreadsheetMimeType,
    folderId,
  );

  if (!templateSpreadsheetId) {
    templateSpreadsheetId = await findAppFile(
      drive,
      TEMPLATE_PENDING_ROLE,
      spreadsheetMimeType,
      folderId,
    );
    if (!templateSpreadsheetId) {
      const created = await drive.files.create({
        requestBody: {
          name: TEMPLATE_NAME,
          mimeType: spreadsheetMimeType,
          parents: [folderId],
          appProperties: { foodbalanceRole: TEMPLATE_PENDING_ROLE },
        },
        fields: "id",
      });
      templateSpreadsheetId = created.data.id ?? null;
    }
    if (!templateSpreadsheetId) {
      throw new Error("Google Drive did not return an ID for the template spreadsheet.");
    }
    await initializeTemplateSpreadsheet(sheets, templateSpreadsheetId);
    await drive.files.update({
      fileId: templateSpreadsheetId,
      supportsAllDrives: true,
      requestBody: {
        appProperties: { foodbalanceRole: "monthly-template" },
      },
      fields: "id",
    });
  }

  return { folderId, templateSpreadsheetId };
}

export async function connectGoogleDriveFromAuthorizationCode(code: string): Promise<{
  connectedEmail: string;
  upcomingProvision: MonthlySheetProvisionResult;
}> {
  const oauth = createGoogleDriveOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not issue a refresh token. Revoke the previous grant and connect again.",
    );
  }

  oauth.setCredentials(tokens);
  const oauthApi = google.oauth2({ version: "v2", auth: oauth });
  const userInfo = await oauthApi.userinfo.get();
  const connectedEmail = userInfo.data.email?.trim();
  if (!connectedEmail) {
    throw new Error("Google account did not provide an email address.");
  }

  const assets = await ensureDriveAssets(tokens.refresh_token);
  await prisma.googleDriveConnection.upsert({
    where: { id: CONNECTION_ID },
    create: {
      id: CONNECTION_ID,
      connectedEmail,
      encryptedRefreshToken: encryptGoogleDriveRefreshToken(tokens.refresh_token),
      folderId: assets.folderId,
      templateSpreadsheetId: assets.templateSpreadsheetId,
    },
    update: {
      connectedEmail,
      encryptedRefreshToken: encryptGoogleDriveRefreshToken(tokens.refresh_token),
      folderId: assets.folderId,
      templateSpreadsheetId: assets.templateSpreadsheetId,
    },
  });

  return {
    connectedEmail,
    upcomingProvision: await ensureMonthlySpreadsheet(getUpcomingMonthKey()),
  };
}

function monthDate(monthKey: string): Date {
  const [month, year] = monthKey.split(".").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

function monthLabel(monthKey: string): string {
  const label = new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate(monthKey));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getUpcomingMonthKey(reference: Date = new Date()): string {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
  }).format(reference);
  const [year, month] = current.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${String(nextMonth).padStart(2, "0")}.${nextYear}`;
}

function monthlyFileQuery(folderId: string, monthKey: string): string {
  return [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
    `appProperties has { key='foodbalanceMonthKey' and value='${escapeDriveQueryValue(monthKey)}' }`,
  ].join(" and ");
}

function safeProvisionError(monthKey: string, error: unknown): MonthlySheetProvisionResult {
  if (isMissingTableError(error)) {
    return {
      ok: false,
      monthKey,
      code: "database_not_ready",
      error: "Схема PostgreSQL ще не оновлена для Google Drive.",
    };
  }

  const message = error instanceof Error ? error.message : "Unknown Google error";
  console.error(`Google Drive provisioning failed for ${monthKey}: ${message}`);
  if (message.includes("invalid_grant") || message.includes("Token has been expired")) {
    return {
      ok: false,
      monthKey,
      code: "token_invalid",
      error: "Доступ Google Drive відкликано або прострочено. Перепідключіть акаунт.",
    };
  }
  return {
    ok: false,
    monthKey,
    code: "google_error",
    error: "Google Drive не зміг створити таблицю. Перевірте підключення та повторіть.",
  };
}

export async function ensureMonthlySpreadsheet(
  monthKey: string,
): Promise<MonthlySheetProvisionResult> {
  if (!isValidMonthKey(monthKey)) {
    return {
      ok: false,
      monthKey,
      code: "invalid_month",
      error: "Невірний формат місяця. Очікується MM.YYYY.",
    };
  }

  if (getMissingEnvironmentVariables().length > 0) {
    return {
      ok: false,
      monthKey,
      code: "not_configured",
      error: "Google Drive OAuth ще не налаштовано в Railway.",
    };
  }

  try {
    const connection = await prisma.googleDriveConnection.findUnique({
      where: { id: CONNECTION_ID },
    });
    if (!connection) {
      return {
        ok: false,
        monthKey,
        code: "not_connected",
        error: "Google Drive ще не підключено в адмін-панелі.",
      };
    }

    const refreshToken = decryptGoogleDriveRefreshToken(
      connection.encryptedRefreshToken,
    );
    const auth = authorizedOAuthClient(refreshToken);
    const drive = google.drive({ version: "v3", auth });
    const lockName = `foodbalance:monthly-sheet:${monthKey}`;

    return await prisma.$transaction(
      async (tx) => {
        // Prisma 7 cannot deserialize PostgreSQL's `void` return type from
        // pg_advisory_xact_lock(). Select a regular integer while still
        // evaluating the locking function in the FROM clause.
        await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${lockName}))`;

        // Monthly Sheets writes still run through the existing service account.
        // Keep its inherited editor permission current even after key/account
        // rotations; child template/month files inherit access from this folder.
        await ensureWriterPermission(
          drive,
          connection.folderId,
          getSheetsServiceAccountEmail(),
        );

        const existingConfig = await tx.sheetConfig.findUnique({
          where: { monthKey },
          select: { spreadsheetId: true },
        });
        if (existingConfig?.spreadsheetId) {
          return {
            ok: true as const,
            monthKey,
            spreadsheetId: existingConfig.spreadsheetId,
            spreadsheetUrl: spreadsheetUrl(existingConfig.spreadsheetId),
            created: false,
            recovered: false,
          };
        }

        const found = await drive.files.list({
          q: monthlyFileQuery(connection.folderId, monthKey),
          spaces: "drive",
          orderBy: "createdTime desc",
          pageSize: 10,
          fields: "files(id)",
        });
        let monthlySpreadsheetId =
          found.data.files?.find((file) => Boolean(file.id))?.id ?? null;
        const recovered = Boolean(monthlySpreadsheetId);

        if (!monthlySpreadsheetId) {
          const copied = await drive.files.copy({
            fileId: connection.templateSpreadsheetId,
            supportsAllDrives: true,
            requestBody: {
              name: `${monthKey} FOODBALANCE`,
              parents: [connection.folderId],
              appProperties: {
                foodbalanceRole: "monthly-orders",
                foodbalanceMonthKey: monthKey,
              },
            },
            fields: "id",
          });
          monthlySpreadsheetId = copied.data.id ?? null;
        }

        if (!monthlySpreadsheetId) {
          throw new Error("Google Drive did not return a monthly spreadsheet ID.");
        }

        await tx.sheetConfig.create({
          data: {
            monthKey,
            spreadsheetId: monthlySpreadsheetId,
            label: monthLabel(monthKey),
          },
        });

        return {
          ok: true as const,
          monthKey,
          spreadsheetId: monthlySpreadsheetId,
          spreadsheetUrl: spreadsheetUrl(monthlySpreadsheetId),
          created: !recovered,
          recovered,
        };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  } catch (error) {
    return safeProvisionError(monthKey, error);
  }
}
