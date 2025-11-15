const mysql = require('mysql2/promise');

async function checkDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'appbucaclinicos'
  });

  console.log('📊 VERIFICANDO BASE DE DATOS\n');

  // Contar usuarios
  const [usuarios] = await connection.query('SELECT COUNT(*) as total FROM usuarios');
  console.log(`👥 Total usuarios: ${usuarios[0].total}`);

  // Listar usuarios
  const [listaUsuarios] = await connection.query('SELECT id, nombre, email, rol FROM usuarios LIMIT 5');
  console.log('\n📋 Usuarios registrados:');
  listaUsuarios.forEach(u => {
    console.log(`  - ID: ${u.id}, Nombre: ${u.nombre}, Email: ${u.email}, Rol: ${u.rol}`);
  });

  // Contar pedidos
  const [pedidos] = await connection.query('SELECT COUNT(*) as total FROM pedidos');
  console.log(`\n📦 Total pedidos: ${pedidos[0].total}`);

  // Listar pedidos
  const [listaPedidos] = await connection.query(`
    SELECT p.id, p.numero_guia, p.estado_actual, u.nombre as cliente
    FROM pedidos p
    LEFT JOIN usuarios u ON p.cliente_id = u.id
    LIMIT 5
  `);
  console.log('\n📋 Pedidos registrados:');
  if (listaPedidos.length === 0) {
    console.log('  ❌ NO HAY PEDIDOS EN LA BASE DE DATOS');
  } else {
    listaPedidos.forEach(p => {
      console.log(`  - ID: ${p.id}, Guía: ${p.numero_guia}, Estado: ${p.estado_actual}, Cliente: ${p.cliente}`);
    });
  }

  await connection.end();
}

checkDB().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
