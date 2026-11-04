// adds the firebase file for android push notifications once it's there (see the EAS build guide).
// everything else lives in app.json.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(firebase)) config.android = { ...config.android, googleServicesFile: './google-services.json' };
  return config;
};
