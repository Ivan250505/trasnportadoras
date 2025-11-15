const mysql = require('mysql2/promise');

async function checkPedido() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'appbucaclinicos'
  });

  console.log('📊 ESTRUCTURA DE UN PEDIDO\n');

  const [pedidos] = await connection.query('SELECT * FROM vista_pedidos_completos LIMIT 1');

  if (pedidos.length > 0) {
    const pedido = pedidos[0];
    console.log('Campos del pedido:\n');
    for (const [key, value] of Object.entries(pedido)) {
      console.log(`  ${key}: ${value} (type: ${typeof value})`);
    }
  } else {
    console.log('No hay pedidos en la base de datos');
  }

  await connection.end();
}

checkPedido().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
