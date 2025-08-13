/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./popup.html",
    "./options.html",
    "./*.js",
    "./**/*.js"
  ],
  theme: {
    extend: {}
  },
  plugins: [require('@tailwindcss/forms')]
}
