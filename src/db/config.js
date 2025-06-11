module.exports = {
    development: {
      username: process.env.DB_USER || "root",
      password: process.env.DB_PWD || null,
      database: process.env.DB_NAME || "rpc_uptime_data",
      host: process.env.DB_HOST || "localhost",
      dialect: "mysql"
    },
    production: {
      username: process.env.DB_USER,
      password: process.env.DB_PWD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      dialect: "mysql"
    }
  };