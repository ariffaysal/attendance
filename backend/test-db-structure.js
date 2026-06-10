const mysql = require('mysql2/promise');

async function testDatabaseStructure() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'attendance'
    });

    console.log('Testing csv_employees table...');
    const [csvRows] = await connection.execute('DESCRIBE csv_employees');
    console.log('csv_employees columns:', csvRows.map(r => r.Field));

    console.log('\nTesting employee_salary_information table...');
    const [empRows] = await connection.execute('DESCRIBE employee_salary_information');
    console.log('employee_salary_information columns:', empRows.map(r => r.Field));

    console.log('\nTesting employee_salary_bank_info table...');
    const [bankRows] = await connection.execute('DESCRIBE employee_salary_bank_info');
    console.log('employee_salary_bank_info columns:', bankRows.map(r => r.Field));

    console.log('\nTesting employee_salary_breakdown table...');
    const [breakdownRows] = await connection.execute('DESCRIBE employee_salary_breakdown');
    console.log('employee_salary_breakdown columns:', breakdownRows.map(r => r.Field));

    console.log('\nTesting csv_employees data...');
    const [csvData] = await connection.execute('SELECT COUNT(*) as count FROM csv_employees LIMIT 5');
    console.log('csv_employees count:', csvData[0].count);

  } catch (error) {
    console.error('Database test error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDatabaseStructure();
