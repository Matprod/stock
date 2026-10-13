import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import admin from 'firebase-admin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const serviceAccountPath = join(__dirname, '../credentials/firebase-credentials.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
})

export default admin
