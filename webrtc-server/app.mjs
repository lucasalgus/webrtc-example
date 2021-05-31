import { createServer } from "http";
import express from "express";
import socketIO from "socket.io";

const app = express();
const server = createServer(app);

const io = socketIO(server);

let users = [];

io.on("connection", (socket) => {
  console.log(socket.id);
  users.push(socket.id);

  socket.on("get-all-users", () => {
    socket.emit("all-users", users);
    socket.broadcast.emit("all-users", users);
  });

  socket.on("offer", (payload) => {
    socket.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    socket.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (incoming) => {
    socket.to(incoming.target).emit("ice-candidate", incoming.candidate);
  });

  socket.on("disconnect", () => {
    users = users.filter((id) => id !== socket.id);
  });
});

server.listen(5001);
