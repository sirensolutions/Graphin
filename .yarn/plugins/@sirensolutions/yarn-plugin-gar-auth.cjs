module.exports = {
  name: `gar-auth`,
  factory: require => {
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);
    let cachedToken

    async function getToken() {
      if (!cachedToken) {
        const {stdout} = await exec('gcloud auth print-access-token');
        cachedToken = stdout.trim();
      }
      return cachedToken;
    }

    return {
      default: {
        hooks: {
          validateProject: getToken,
          getNpmAuthenticationHeader: async () => `Bearer ${await getToken()}`
        }
      }
    };
  }
};
