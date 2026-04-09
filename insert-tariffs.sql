INSERT INTO "Tariff" (id, name, title, kcal, price, "basePrice", "imageUrl") VALUES
  (gen_random_uuid(), 'Slim', 'Slim', '≈ 1450–1650 ккал', 'від 610 ₴', 610, ''),
  (gen_random_uuid(), 'Balance', 'Balance', '≈ 1750–1950 ккал', 'від 700 ₴', 700, ''),
  (gen_random_uuid(), 'Active', 'Active', '≈ 2100–2350 ккал', 'від 800 ₴', 800, ''),
  (gen_random_uuid(), 'Sport', 'Sport Active+', '≈ 2500–2800 ккал', 'від 900 ₴', 900, ''),
  (gen_random_uuid(), 'Sushka XS', 'Сушка XS', '≈ 1600–1800 ккал', 'від 500 ₴', 500, ''),
  (gen_random_uuid(), 'Sushka S', 'Сушка S', '≈ 1600–1800 ккал', 'від 600 ₴', 600, ''),
  (gen_random_uuid(), 'Indiv', 'Індивідуальний', 'За вашим планом', 'від 700 ₴', 700, '')
ON CONFLICT (name) DO NOTHING;
