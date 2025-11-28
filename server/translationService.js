const { GoogleGenerativeAI } = require('@google/generative-ai')

let genAI = null
let availableModel = null

if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  findAvailableModel().catch(err => {
    console.warn('[Gemini] Erreur lors de la recherche de modèle:', err.message)
  })
}

async function findAvailableModel() {
  if (!genAI) return null

  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro',
  ]

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const testPromise = model.generateContent('test')
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )

      const result = await Promise.race([testPromise, timeoutPromise])
      await result.response
      availableModel = modelName
      console.log(`[Gemini] ✅ Modèle disponible trouvé: ${modelName}`)
      return modelName
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.log(`[Gemini] ⚠️  Modèle ${modelName} non disponible (404)`)
      } else {
        console.log(`[Gemini] ⚠️  Modèle ${modelName} erreur: ${error.message.substring(0, 50)}`)
      }
    }
  }

  console.warn('[Gemini] Aucun modèle disponible trouvé. Vérifiez votre clé API.')
  return null
}

async function translateText(text, targetLanguage = 'fr') {
  if (!text || !text.trim()) {
    throw new Error('Texte vide')
  }

  if (genAI) {
    try {
      return await translateWithGemini(text, targetLanguage)
    } catch (error) {
      console.warn('[Translation] Gemini a échoué, utilisation du mode simulation:', error.message)
      console.warn('[Translation] Erreur détaillée:', error)
      return simulateTranslation(text, targetLanguage)
    }
  }

  console.warn('[Translation] Gemini API non configurée, utilisation du mode simulation')
  return simulateTranslation(text, targetLanguage)
}

async function translateWithGemini(text, targetLanguage) {
  try {
    if (!availableModel) {
      await findAvailableModel()
    }

    if (!availableModel) {
      throw new Error('Aucun modèle Gemini disponible. Vérifiez votre clé API et les modèles disponibles.')
    }

    const model = genAI.getGenerativeModel({ model: availableModel })

    const languageNames = {
      'fr': 'français',
      'en': 'anglais',
      'es': 'espagnol',
      'de': 'allemand',
      'it': 'italien',
      'pt': 'portugais'
    }

    const targetLanguageName = languageNames[targetLanguage] || targetLanguage

    const prompt = `Traduis le texte suivant du portugais vers le ${targetLanguageName}. 
Réponds UNIQUEMENT avec la traduction, sans commentaires ni explications.

Texte à traduire: "${text}"

Traduction:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const translatedText = response.text().trim()

    return translatedText
      .replace(/^["']|["']$/g, '')
      .replace(/^Traduction:\s*/i, '')
      .trim()
  } catch (error) {
    console.error('[Gemini] Erreur de traduction:', error)
    throw new Error(`Erreur de traduction: ${error.message}`)
  }
}

function simulateTranslation(text, targetLanguage) {
  const translations = {
    'fr': {
      'Olá, como você está?': 'Bonjour, comment allez-vous ?',
      'Bom dia, tudo bem?': 'Bonjour, tout va bien ?',
      'Obrigado pela sua ajuda': 'Merci pour votre aide',
      'Por favor, pode me ajudar?': 'S\'il vous plaît, pouvez-vous m\'aider ?',
      'Eu gosto muito deste aplicativo': 'J\'aime beaucoup cette application'
    },
    'en': {
      'Olá, como você está?': 'Hello, how are you?',
      'Bom dia, tudo bem?': 'Good morning, is everything okay?',
      'Obrigado pela sua ajuda': 'Thank you for your help',
      'Por favor, pode me ajudar?': 'Please, can you help me?',
      'Eu gosto muito deste aplicativo': 'I really like this application'
    },
    'es': {
      'Olá, como você está?': 'Hola, ¿cómo estás?',
      'Bom dia, tudo bem?': 'Buenos días, ¿todo bien?',
      'Obrigado pela sua ajuda': 'Gracias por tu ayuda',
      'Por favor, pode me ajudar?': 'Por favor, ¿puedes ayudarme?',
      'Eu gosto muito deste aplicativo': 'Me gusta mucho esta aplicación'
    },
    'de': {
      'Olá, como você está?': 'Hallo, wie geht es dir?',
      'Bom dia, tudo bem?': 'Guten Morgen, alles gut?',
      'Obrigado pela sua ajuda': 'Danke für deine Hilfe',
      'Por favor, pode me ajudar?': 'Bitte, kannst du mir helfen?',
      'Eu gosto muito deste aplicativo': 'Ich mag diese Anwendung sehr'
    },
    'it': {
      'Olá, como você está?': 'Ciao, come stai?',
      'Bom dia, tudo bem?': 'Buongiorno, tutto bene?',
      'Obrigado pela sua ajuda': 'Grazie per il tuo aiuto',
      'Por favor, pode me ajudar?': 'Per favore, puoi aiutarmi?',
      'Eu gosto muito deste aplicativo': 'Mi piace molto questa applicazione'
    }
  }

  const langTranslations = translations[targetLanguage] || translations['fr']

  if (langTranslations[text]) {
    return langTranslations[text]
  }

  return `[Mode simulation - ${targetLanguage}] ${text}`
}

module.exports = {
  translateText,
  simulateTranslation
}
