const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { FIREBASE_SERVICE_ACCOUNT } = require('./env');

let firebaseInitialized = false;

function initializeFirebase() {
  const serviceAccountPath = path.resolve(FIREBASE_SERVICE_ACCOUNT);

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK inicializado correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar Firebase Admin SDK:', error.message);
      console.error('   Las notificaciones push NO funcionarán');
      return false;
    }
  } else {
    console.warn('⚠️ Archivo de cuenta de servicio de Firebase no encontrado');
    console.warn(`   Buscado en: ${serviceAccountPath}`);
    console.warn('   Las notificaciones push NO funcionarán');
    console.warn('   Descarga el archivo desde Firebase Console y guárdalo como firebase-service-account.json');
    return false;
  }
}

function isFirebaseInitialized() {
  return firebaseInitialized;
}

function getFirebaseAdmin() {
  return admin;
}

module.exports = {
  initializeFirebase,
  isFirebaseInitialized,
  getFirebaseAdmin
};
