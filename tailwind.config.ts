import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f6ff",
          100: "#dbe9ff",
          200: "#b3d1ff",
          300: "#80b3ff",
          400: "#4d8fff",
          500: "#2166f0",
          600: "#1650c0",
          700: "#123f96",
          800: "#0f2f6e",
          900: "#0a1f4a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
