const http = require("http");
const fs = require("fs");

const Server = http.createServer((req, res) => {
  console.log("server running on port 09191");
  res.end("server started");
});

Server.listen(09192, ()=> {
  console.log("Server started")
});