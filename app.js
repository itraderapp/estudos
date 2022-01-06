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

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function (id, description) {
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

  //TUDO COMEÇA AQUI - Quando recebo mensagem
  client.on('message', async msg => {

    // let chat_activos = await client.getChatById(msg.from);
    // console.log(chat_activos);

    // let mensajes_verificar = await chat_activos.fetchMessages();
    // console.log(mensajes_verificar.length);

    // console.log(msg);
    // console.log('Enviada de: ' + msg.from);
    // console.log('Enviada para: ' + msg.to);
    // console.log(sessao.length);

    //VERIFICAR MENSAGEM X PARA O ROBO X
    for (var i = 0; i < sessao.length; i++) {

      //VERIFICAR SE A SESSAO ESTA CONECTADA
      if (sessao[i].ready == true && msg.to == sessao[i].description) {

        // console.log('Numero do Telefone: '+sessao[i].description);

        //Nome da Tabela para pegar dados
        var tabela = sessao[i].id;
        const keyword = msg.body.toLowerCase(); //Palavras em minusculo
        //---

        // VERIFICAR SE ESSE CHAT é CONTATO ou Não
        const contatoWp = await db.getContatos(tabela); //Verificar se selecionou só para contatos
        const replyMessage = await db.getReply(tabela, keyword); //pegar dados do Db
        const userStatus = await db.getUser(tabela); //Verificar Se é usuário PRO
        const boasVindas = await db.getBoasVindas(tabela); //Verificar Msg Boas Vindas

        //VERIFICAR PRIMEIRA MENSAGEM DO CONTATO
        const chat_activos = await client.getChatById(msg.from);
        const mensajes_verificar = await chat_activos.fetchMessages();





        //VERIFICAR SE CHAT É: GRUPO / CONTATO
        client.getChatById(msg.from).then(dados => {
          // console.log(dados);

          //VERIFICAR SE É GRUPO
          if (dados.isGroup == false) {
            // console.log('Não é Grupo');


            // //VERIFICAR PRIMEIRA MENSAGEM DO CONTATO
            // // let chat_activos = await client.getChatById(msg.from);
            // // let mensajes_verificar = await chat_activos.fetchMessages();
            // var listaMsg = [];
            // var primeiraMsg = false;
            // var primeiraMsgHoje = false;

            // for (var i = 0; i < 50; i++) {

            //   if (msg.from == mensajes_verificar[i].from) {
            //     // console.log(mensajes_verificar[i]);
            //     listaMsg.push(mensajes_verificar[i]);
            //   }

            // }

            // console.log(listaMsg);
            // console.log(listaMsg.length);
            // var numList = listaMsg.length - 2;
            // console.log(numList);
            // console.log(listaMsg[numList]);
            // console.log(listaMsg[numList].timestamp);

            // if (listaMsg.length < 2) {
            //   // console.log('Primeira Mensagem');
            //   primeiraMsg = true;
            // } else {
            //   // console.log('Já tem conversa no WP');
            //   // console.log(listaMsg[numList].timestamp);
            //   //---
            //   var hoje = new Date().toLocaleDateString("pt-br");
            //   var dia = new Date(listaMsg[numList].timestamp * 1000);
            //   //---
            //   console.log(dia.toLocaleDateString("pt-br"));
            //   console.log(hoje);
            //   if (toString(hoje) !== toString(dia)) {
            //     console.log('Não enviou mensagem hoje!');
            //     primeiraMsgHoje = true;
            //   }
            // }

            // console.log('2 ' + mensajes_verificar.length);

            var listaMsg = [];
            var primeiraMsg = false;
            var primeiraMsgHoje = false;

            if (mensajes_verificar.length == 1) {

              // console.log('Primeira Mensagem');
              primeiraMsg = true;

            } else {
              // console.log('Tem várias Mensagens');

              for (var i = 0; i < 50; i++) {

                if (msg.from == mensajes_verificar[i].from) {
                  // console.log(mensajes_verificar[i]);
                  listaMsg.push(mensajes_verificar[i]);
                }

              }

              var numList = listaMsg.length - 2;

              //---
              var hoje = new Date().toLocaleDateString("pt-br");
              var dia = new Date(listaMsg[numList].timestamp * 1000);
              //---
              // console.log(dia.toLocaleDateString("pt-br"));
              // console.log(hoje);
              if (toString(hoje) !== toString(dia)) {
                // console.log('Não enviou mensagem hoje!');
                primeiraMsgHoje = true;
              }
            }




            //Mandar autoZap para TODOS //!todos!
            if (contatoWp == '!todos!') {

              //CHAMANDO MSG DO MENU
              if (replyMessage !== false) {
                msg.reply(replyMessage);
              }

              //MSG DE BOAS VINDAS
              if (boasVindas !== false && replyMessage == false) {

                if (primeiraMsg == true || primeiraMsgHoje == true) {
                  client.sendMessage(msg.from, boasVindas);
                }

              }

              //Mensagem FREE com link do App
              if (replyMessage !== false && boasVindas !== false && userStatus == false) {
                client.sendMessage(msg.from, 'Criado com AutoZap -> https://www.autozap.app.br');
              }

            }

            //Mandar autoZap Contatos
            if (contatoWp == '!contatos!' && dados.name.substring(0, 1) !== '+') {

              //CHAMANDO MSG DO MENU
              if (replyMessage !== false) {
                msg.reply(replyMessage);
              }

              //MSG DE BOAS VINDAS
              if (boasVindas !== false && replyMessage == false) {

                if (primeiraMsg == true || primeiraMsgHoje == true) {
                  client.sendMessage(msg.from, boasVindas);
                }

              }

              //Mensagem FREE com link do App
              if (replyMessage !== false && boasVindas !== false && userStatus == false) {
                client.sendMessage(msg.from, 'Criado com AutoZap -> https://www.autozap.app.br');
              }

            }

            //Mandar autoZap Não Contatos //!naocontatos!
            if (contatoWp == '!naocontatos!' && dados.name.substring(0, 1) == '+') {

              //CHAMANDO MSG DO MENU
              if (replyMessage !== false) {
                msg.reply(replyMessage);
              }

              //MSG DE BOAS VINDAS
              if (boasVindas !== false && replyMessage == false) {

                if (primeiraMsg == true || primeiraMsgHoje == true) {
                  client.sendMessage(msg.from, boasVindas);
                }

              }

              //Mensagem FREE com link do App
              if (replyMessage !== false && boasVindas !== false && userStatus == false) {
                client.sendMessage(msg.from, 'Criado com AutoZap -> https://www.autozap.app.br');
              }

            }



          }//if se é Grupo ou não.
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
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        console.error(err);
      }
    });
  });

  client.on('auth_failure', function (session) {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    fs.unlinkSync(SESSION_FILE_PATH, function (err) {
      if (err) return console.log(err);
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

const init = function (socket) {
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
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});


server.listen(port, function () {
  console.log('App running on *: ' + port);
});
