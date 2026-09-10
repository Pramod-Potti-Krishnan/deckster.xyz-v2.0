// Offline local Builder development only: use the installed Inter face when
// available and Next's normal fallback otherwise. Never fetch Google Fonts.
// This does not affect the iframe's measured presentation font contract.
module.exports = { 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': "@font-face {font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: swap; src: local('Inter');}" }
