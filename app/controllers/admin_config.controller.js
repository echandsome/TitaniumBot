const logger = require('log4js').getLogger('admin_config_controller');
const AdminConfigs = require('../model/Admin_configs');

/**
 * @class - AdminConfig class containing all the controllers
 */

class AdminConfig {
  async getAllConfigs() {
    const configs = await AdminConfigs.findOne().sort({ updatedAt: -1 });
    return { data: configs };
  }

  async updateConfigs(user, _id, minimum_difference, max_token_limit) {
    const adminConfigs = await AdminConfigs.findByIdAndUpdate(_id, {
      minimum_difference,
      max_token_limit,
    }, { new: true });
    // logger.info(`Updated admin configs successfully by: ${user.id}`);
    return { data: adminConfigs };
  }
}

module.exports = AdminConfig;
