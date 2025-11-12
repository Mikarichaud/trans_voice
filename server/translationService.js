// Service de traduction utilisant l'API Gemini de Google

const { GoogleGenerativeAI } = require('@google/generative-ai')

let genAI = null
let availableModel = null // Modèle qui fonctionne

// Initialiser Gemini si la clé API est disponible
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  // Trouver un modèle disponible au démarrage (de manière asynchrone)
  findAvailableModel().catch(err => {
    console.warn('[Gemini] Erreur lors de la recherche de modèle:', err.message)
  })
}

/**
 * Trouve un modèle Gemini disponible en essayant plusieurs options
 */
async function findAvailableModel() {
  if (!genAI) return null

  // Liste des modèles à essayer (par ordre de préférence)
  const modelsToTry = [
    'gemini-2.0-flash', // Nouveau modèle (v1beta)
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro', // Ancien modèle (peut ne plus être disponible)
  ]

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      // Tester avec une requête simple (timeout de 5 secondes)
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
      // Continuer avec le modèle suivant
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

/**
 * Traduit un texte du portugais vers la langue cible
 * @param {string} text - Texte à traduire (en portugais)
 * @param {string} targetLanguage - Langue cible (fr, en, es, etc.)
 * @returns {Promise<string>} - Texte traduit
 */
async function translateText(text, targetLanguage = 'fr') {
  if (!text || !text.trim()) {
    throw new Error('Texte vide')
  }

  // Si Gemini est disponible, l'utiliser
  if (genAI) {
    try {
      return await translateWithGemini(text, targetLanguage)
    } catch (error) {
      // Si Gemini échoue (problème réseau, API indisponible, etc.), utiliser le mode simulation
      console.warn('[Translation] Gemini a échoué, utilisation du mode simulation:', error.message)
      console.warn('[Translation] Erreur détaillée:', error)
      return simulateTranslation(text, targetLanguage)
    }
  }

  // Sinon, utiliser une traduction de base (à remplacer par un vrai service)
  console.warn('[Translation] Gemini API non configurée, utilisation du mode simulation')
  return simulateTranslation(text, targetLanguage)
}

/**
 * Traduction avec Gemini API
 */
async function translateWithGemini(text, targetLanguage) {
  try {
    // Si aucun modèle disponible n'a été trouvé, essayer de le trouver maintenant
    if (!availableModel) {
      await findAvailableModel()
    }

    // Si toujours aucun modèle disponible, lever une erreur
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

    // Nettoyer la réponse si elle contient des guillemets ou des préfixes
    return translatedText
      .replace(/^["']|["']$/g, '')
      .replace(/^Traduction:\s*/i, '')
      .trim()
  } catch (error) {
    console.error('[Gemini] Erreur de traduction:', error)
    throw new Error(`Erreur de traduction: ${error.message}`)
  }
}

/**
 * Simulation de traduction (pour la démo)
 * À REMPLACER par un vrai service de traduction en production
 */
function simulateTranslation(text, targetLanguage) {
  // Traductions d'exemple pour la démo
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
  
  // Si on a une traduction exacte, l'utiliser
  if (langTranslations[text]) {
    return langTranslations[text]
  }
  
  // Sinon, retourner un message indiquant que c'est une simulation
  // avec le texte original (pour que l'utilisateur voie quand même le résultat)
  return `[Mode simulation - ${targetLanguage}] ${text}`
}

module.exports = {
  translateText,
  simulateTranslation
}


