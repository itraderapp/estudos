const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
// const { phoneNumberFormatter } = require('./helpers/formatter');
// const axios = require('axios');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.get('/', (req, res) => {

  res.sendFile('inicio.html', {
    root: __dirname
  });

  // global.tabela = req.query.bot;

});

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch(err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function(sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function(err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function() {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function(id, description) {
  // console.log('Creating session: ' + id);
  const SESSION_FILE_PATH = `./whatsapp-session-${id}.json`;
  let sessionCfg;
  if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
  }

  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    session: sessionCfg
  });

  const db = require('./helpers/db');
  const sessao = require('./whatsapp-sessions.json');

  client.on('message', async msg => {

    // console.log(msg);
    // console.log(msg.to);
    // console.log(sessao.length);

    for (var i = 0; i < sessao.length; i++) {

      // console.log(sessao[i].ready);
      // console.log(sessao[i].description);

      if(sessao[i].ready == true && msg.to == sessao[i].description){

        // console.log('Numero do Telefone: '+sessao[i].description);

        var tabela = sessao[i].id;

        const keyword = msg.body.toLowerCase();
        const replyMessage = await db.getReply( tabela, keyword );
        const userStatus = await db.getUser(tabela);

        // console.log(replyMessage);
        // console.log(userStatus);

        client.getChats().then(chats => {
          const groups = chats.filter(chat => chat.isGroup);
          const isGroup = [];
      
          for (var i = 0; i < groups.length; i++) {
            // console.log('GRUPO: ' + groups[i].id._serialized);
      
            if (msg.id.remote == groups[i].id._serialized) {
              // console.log('Isto é um grupo.');
              isGroup.push(groups[i].id._serialized);
            }
      
          }
      
          // console.log(isGroup.length);
      
          if (isGroup.length == 0) {
            // console.log('Mensagem no CHAT normal.');
      
            if(replyMessage !== false) {
              msg.reply(replyMessage);
            }

            //Mensagem FREE com link do App
            if(replyMessage !== false && userStatus == false){
              client.sendMessage(msg.from, 'Criado com AutoZap -> https://www.autozap.app.br');
            }

      
          } else {
            // console.log('Mensagem no GRUPO.');
          }
          
        });


      }//fim do if(msg.to == sessao[i].description) 
    }//fim do For

  });

  client.initialize();

  client.on('qr', (qr) => {
    // console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, src: url });
      io.emit('message', { id: id, text: 'QR Code received, scan please!' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is ready!' });

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('authenticated', (session) => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is authenticated!' });
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
      if (err) {
        console.error(err);
      }
    });
  });

  client.on('auth_failure', function(session) {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    fs.unlinkSync(SESSION_FILE_PATH, function(err) {
        if(err) return console.log(err);
        console.log('Session file deleted!');
    });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
}

const init = function(socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(sess.id, sess.description);
      });
    }
  }
}

init();

// Socket IO
io.on('connection', function(socket) {
  init(socket);

  socket.on('create-session', function(data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});


server.listen(port, function() {
  console.log('App running on *: ' + port);
});
