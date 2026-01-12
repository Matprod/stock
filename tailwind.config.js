/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#142836",
        "light-primary": "#5AC5F2",
        "main-gray": "#A6B4BC",
        "background-dark-blue": "#1E2638",
      },
    },
  },
  safelist: [
    "stroke-orange-500",
    "stroke-green-500",
    "stroke-red-500",
    "stroke-gray-500",
    "text-red-500",
    "text-orange-500",
    "text-green-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-green-500",
  ],
  plugins: [require("tailwindcss-animate")],
};
