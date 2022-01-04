const mysql = require('mysql2/promise');

const createConnection = async () => {
	return await mysql.createConnection({
		host: '31.170.163.156',
		user: 'autozapapp_user',
		password: 'Ze+Pri3110',
		database: 'autozapapp_app'
	});
}

const getReply = async (tabela , keyword) => {
	//console.log(tabela);
	const connection = await createConnection();
	// ALTERAR NOME DA TABELA = test_bot
	const [rows] = await connection.execute('SELECT message FROM '+tabela+' WHERE keyword = ?', [keyword]);
	if (rows.length > 0) return rows[0].message;
	return false;
}

const getUser = async (tabela) => {
	const connection = await createConnection();
	const [rows] = await connection.execute('SELECT message FROM '+tabela+' WHERE keyword = "usuarioproautozap" ');
	if (rows.length > 0) return rows[0].message;
	return false;
}

module.exports = {
	createConnection,
	getReply,
	getUser
}