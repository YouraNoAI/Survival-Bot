import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

// Load database
function loadDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red('Error loading database'), error);
    process.exit(1);
  }
}

// Save database
function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.green('✓ Data tersimpan'));
  } catch (error) {
    console.error(chalk.red('Error saving database'), error);
  }
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Display transactions as table
function displayTransactionsTable(transactions) {
  if (transactions.length === 0) {
    console.log(chalk.yellow('Tidak ada transaksi'));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('Tanggal'),
      chalk.cyan('Item'),
      chalk.cyan('Kategori'),
      chalk.cyan('Tipe'),
      chalk.cyan('Nominal'),
      chalk.cyan('Keterangan')
    ],
    style: { compact: false, 'padding-left': 1, 'padding-right': 1 },
    wordWrap: true,
    colWidths: [12, 20, 15, 12, 15, 30]
  });

  transactions.forEach((tx) => {
    const typeColor = tx.type === 'income' ? chalk.green('+') : chalk.red('-');
    const amountColor = tx.type === 'income' ? chalk.green : chalk.red;

    table.push([
      tx.date,
      tx.item,
      tx.category,
      typeColor + tx.type,
      amountColor(`${tx.amount.toLocaleString('id-ID')}`),
      tx.description.substring(0, 28)
    ]);
  });

  console.log(table.toString());
}

// Display wallet summary
function displayWalletSummary(db) {
  console.log(chalk.cyan.bold('\n═══════════════════════════════'));
  console.log(chalk.cyan.bold('       RINGKASAN DOMPET'));
  console.log(chalk.cyan.bold('═══════════════════════════════'));
  console.log(chalk.white(`Nama            : ${db.user}`));
  console.log(chalk.white(`Mata Uang       : ${db.currency}`));
  console.log(chalk.white(`Pendapatan/Bln  : Rp ${db.monthly_income.toLocaleString('id-ID')}`));
  console.log(chalk.green.bold(`Saldo Sekarang  : Rp ${db.current_balance.toLocaleString('id-ID')}`));

  // Calculate income and expense
  let totalIncome = 0;
  let totalExpense = 0;

  db.transactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }
  });

  console.log(chalk.green(`Total Masuk     : Rp ${totalIncome.toLocaleString('id-ID')}`));
  console.log(chalk.red(`Total Keluar    : Rp ${totalExpense.toLocaleString('id-ID')}`));
  console.log(chalk.cyan.bold('═══════════════════════════════\n'));
}

// Add income
async function addIncome(db) {
  const incomeTypes = ['Ayah', 'Ibu', 'Gaji', 'Cashback', 'Hutang', 'Bonus', 'Lainnya'];

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: 'Pilih sumber pemasukan:',
      choices: incomeTypes
    },
    {
      type: 'number',
      name: 'amount',
      message: 'Jumlah pemasukan (Rp):',
      validate: (input) => input > 0 ? true : 'Jumlah harus lebih dari 0'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Keterangan (opsional):'
    }
  ]);

  const newTransaction = {
    date: getTodayDate(),
    item: answers.source,
    category: 'Pemasukan',
    amount: answers.amount,
    type: 'income',
    importance_rating: 5,
    description: answers.description || `Pemasukan dari ${answers.source}`
  };

  db.transactions.push(newTransaction);
  db.current_balance += answers.amount;
  saveDB(db);

  console.log(chalk.green.bold('\n✓ Pemasukan berhasil ditambahkan!\n'));
  console.log(chalk.cyan('Transaksi Terbaru:'));
  displayTransactionsTable([newTransaction]);
  console.log(chalk.green.bold(`Saldo Baru: Rp ${db.current_balance.toLocaleString('id-ID')}\n`));
}

// Add expense
async function addExpense(db) {
  const expenseCategories = ['Makan', 'Transportasi', 'Kosan', 'Belanja', 'Hiburan', 'Kesehatan', 'Lain-lain'];

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'item',
      message: 'Nama pengeluaran:'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Pilih kategori:',
      choices: expenseCategories
    },
    {
      type: 'number',
      name: 'amount',
      message: 'Jumlah pengeluaran (Rp):',
      validate: (input) => input > 0 ? true : 'Jumlah harus lebih dari 0'
    },
    {
      type: 'list',
      name: 'importance',
      message: 'Tingkat Kepentingan:',
      choices: ['5 - Sangat Penting', '4 - Penting', '3 - Normal', '2 - Kurang Penting', '1 - Tidak Penting'],
      default: '5 - Sangat Penting'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Keterangan:'
    }
  ]);

  const importanceRating = parseInt(answers.importance.split(' ')[0]);

  const newTransaction = {
    date: getTodayDate(),
    item: answers.item,
    category: answers.category,
    amount: answers.amount,
    type: 'expense',
    importance_rating: importanceRating,
    description: answers.description
  };

  db.transactions.push(newTransaction);
  db.current_balance -= answers.amount;
  saveDB(db);

  console.log(chalk.green.bold('\n✓ Pengeluaran berhasil dicatat!\n'));
  console.log(chalk.cyan('Transaksi Terbaru:'));
  displayTransactionsTable([newTransaction]);
  console.log(chalk.red.bold(`Saldo Baru: Rp ${db.current_balance.toLocaleString('id-ID')}\n`));
}

// View wallet
async function viewWallet(db) {
  displayWalletSummary(db);

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'filter',
      message: 'Lihat transaksi:',
      choices: [
        'Semua Transaksi',
        'Hanya Pemasukan',
        'Hanya Pengeluaran',
        'Transaksi Hari Ini',
        'Kembali ke Menu Utama'
      ]
    }
  ]);

  let filtered = db.transactions;

  if (answer.filter === 'Hanya Pemasukan') {
    filtered = db.transactions.filter(tx => tx.type === 'income');
  } else if (answer.filter === 'Hanya Pengeluaran') {
    filtered = db.transactions.filter(tx => tx.type === 'expense');
  } else if (answer.filter === 'Transaksi Hari Ini') {
    const today = getTodayDate();
    filtered = db.transactions.filter(tx => tx.date === today);
  } else if (answer.filter === 'Kembali ke Menu Utama') {
    return;
  }

  console.log(chalk.cyan.bold('\n═══════════════════════════════'));
  console.log(chalk.cyan.bold(`   ${answer.filter.toUpperCase()}`));
  console.log(chalk.cyan.bold('═══════════════════════════════\n'));
  displayTransactionsTable(filtered);
  console.log('');
}

// View debt
async function viewDebt(db) {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Manajemen Hutang:',
      choices: [
        'Lihat Hutang',
        'Tambah Hutang',
        'Lunasi Hutang',
        'Kembali'
      ]
    }
  ]);

  if (answer.action === 'Lihat Hutang') {
    const debts = db.transactions.filter(tx =>
      tx.type === 'expense' && (tx.category === 'Hutang' || tx.item.toLowerCase().includes('hutang'))
    );

    if (debts.length === 0) {
      console.log(chalk.green('\n✓ Anda tidak memiliki hutang!\n'));
    } else {
      console.log(chalk.yellow.bold('\n═══════════════════════════════'));
      console.log(chalk.yellow.bold('       DAFTAR HUTANG'));
      console.log(chalk.yellow.bold('═══════════════════════════════\n'));
      displayTransactionsTable(debts);
    }
  } else if (answer.action === 'Tambah Hutang') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'creditor',
        message: 'Hutang dari siapa/mana:'
      },
      {
        type: 'number',
        name: 'amount',
        message: 'Jumlah hutang (Rp):',
        validate: (input) => input > 0 ? true : 'Jumlah harus lebih dari 0'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Catatan/Rencana pelunasan:'
      }
    ]);

    const newDebt = {
      date: getTodayDate(),
      item: `Hutang - ${answers.creditor}`,
      category: 'Hutang',
      amount: answers.amount,
      type: 'expense',
      importance_rating: 5,
      description: answers.description
    };

    db.transactions.push(newDebt);
    saveDB(db);
    console.log(chalk.green.bold('\n✓ Hutang berhasil dicatat!\n'));
  }
}

// Edit transaction
async function editTransaction(db) {
  if (db.transactions.length === 0) {
    console.log(chalk.yellow('\nTidak ada transaksi untuk diedit\n'));
    return;
  }

  const choices = db.transactions.map((tx, idx) => ({
    name: `${tx.date} - ${tx.item} (Rp ${tx.amount.toLocaleString('id-ID')})`,
    value: idx
  }));

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'transactionIdx',
      message: 'Pilih transaksi yang akan diedit:',
      choices: [...choices, { name: 'Kembali', value: -1 }]
    }
  ]);

  if (answer.transactionIdx === -1) return;

  const tx = db.transactions[answer.transactionIdx];

  const editAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'field',
      message: 'Apa yang ingin diedit?',
      choices: ['Nama Item', 'Kategori', 'Nominal', 'Deskripsi', 'Kembali']
    }
  ]);

  if (editAnswer.field === 'Nama Item') {
    const name = await inquirer.prompt([
      { type: 'input', name: 'item', message: 'Nama item baru:' }
    ]);
    tx.item = name.item;
  } else if (editAnswer.field === 'Kategori') {
    const cat = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Kategori baru:',
        choices: ['Makan', 'Transportasi', 'Kosan', 'Belanja', 'Hiburan', 'Kesehatan', 'Lain-lain']
      }
    ]);
    tx.category = cat.category;
  } else if (editAnswer.field === 'Nominal') {
    const oldAmount = tx.amount;
    const amount = await inquirer.prompt([
      {
        type: 'number',
        name: 'amount',
        message: 'Nominal baru (Rp):',
        validate: (input) => input > 0 ? true : 'Jumlah harus lebih dari 0'
      }
    ]);
    const difference = amount.amount - oldAmount;
    if (tx.type === 'income') {
      db.current_balance += difference;
    } else {
      db.current_balance -= difference;
    }
    tx.amount = amount.amount;
  } else if (editAnswer.field === 'Deskripsi') {
    const desc = await inquirer.prompt([
      { type: 'input', name: 'description', message: 'Deskripsi baru:' }
    ]);
    tx.description = desc.description;
  } else {
    return;
  }

  saveDB(db);
  console.log(chalk.green.bold('\n✓ Transaksi berhasil diubah!\n'));
  displayTransactionsTable([tx]);
}

// Main menu
async function mainMenu(db) {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'menu',
      message: chalk.cyan.bold('\n╔════════════════════════╗\n║   APLIKASI CATATAN     ║\n║  UANG DAN TRANSAKSI    ║\n╚════════════════════════╝\n\nSilahkan pilih aksi:'),
      choices: [
        '1. Pemasukan',
        '2. Pengeluaran',
        '3. Lihat Dompet',
        '4. Manajemen Hutang',
        '5. Edit Transaksi',
        '6. Keluar'
      ]
    }
  ]);

  switch (answer.menu) {
    case '1. Pemasukan':
      await addIncome(db);
      break;
    case '2. Pengeluaran':
      await addExpense(db);
      break;
    case '3. Lihat Dompet':
      await viewWallet(db);
      break;
    case '4. Manajemen Hutang':
      await viewDebt(db);
      break;
    case '5. Edit Transaksi':
      await editTransaction(db);
      break;
    case '6. Keluar':
      console.log(chalk.green.bold('\nTerima kasih telah menggunakan aplikasi. Selamat tinggal! 👋\n'));
      process.exit(0);
  }

  // Reload DB and show menu again
  db = loadDB();
  await mainMenu(db);
}

// Start app
console.clear();
console.log(chalk.cyan.bold('🚀 Memulai aplikasi...\n'));
const db = loadDB();
mainMenu(db);
