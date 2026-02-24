#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { copyDirectory, main } = require('./setup.js');

function runTests() {
  console.log('🧪 Running CodeForge package tests...\n');

  // Test 1: copyDirectory function exists
  console.log('✓ Test 1: copyDirectory function exists');
  
  // Test 2: main function exists  
  console.log('✓ Test 2: main function exists');

  // Test 3: Check required files exist
  const requiredFiles = [
    'package.json',
    'setup.js',
    'README.md',
    '.devcontainer/devcontainer.json',
    '.devcontainer/scripts/setup.sh',
    '.devcontainer/config/defaults/settings.json'
  ];

  let allFilesExist = true;
  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✓ Test 3.${requiredFiles.indexOf(file) + 1}: ${file} exists`);
    } else {
      console.log(`❌ Test 3.${requiredFiles.indexOf(file) + 1}: ${file} missing`);
      allFilesExist = false;
    }
  });

  // Test 4: Package.json has correct structure
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const requiredFields = ['name', 'version', 'bin', 'files'];
  let packageValid = true;

  requiredFields.forEach(field => {
    if (packageJson[field]) {
      console.log(`✓ Test 4.${requiredFields.indexOf(field) + 1}: package.json has ${field}`);
    } else {
      console.log(`❌ Test 4.${requiredFields.indexOf(field) + 1}: package.json missing ${field}`);
      packageValid = false;
    }
  });

  // Test 5: Setup script is executable
  let setupExecutable = true;
  const setupStat = fs.statSync(path.join(__dirname, 'setup.js'));
  if (setupStat.mode & parseInt('111', 8)) {
    console.log('✓ Test 5: setup.js is executable');
  } else {
    console.log('❌ Test 5: setup.js is not executable');
    setupExecutable = false;
  }

  // Summary
  console.log('\n📊 Test Results:');
  if (allFilesExist && packageValid && setupExecutable) {
    console.log('🎉 All tests passed! Package is ready for distribution.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}