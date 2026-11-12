const deny=()=>{throw new Error('Native source proof denies outbound sockets')};require('node:net').Socket.prototype.connect=deny;require('node:tls').connect=deny;globalThis.fetch=deny;
