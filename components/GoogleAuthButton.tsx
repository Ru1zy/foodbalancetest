import { FaGoogle } from "react-icons/fa";

export default function GoogleAuthButton() {
  return (
    <a
      href="/api/auth/google/login"
      className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
    >
      <FaGoogle className="w-5 h-5 text-red-500" />
      <span className="font-medium text-gray-700 group-hover:text-gray-900">
        Увійти через Google
      </span>
    </a>
  );
}
