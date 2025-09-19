import { urlJoin } from 'url-join-ts'
import { getUniversalFetch } from '../universal-fetch'
import { getSettings } from '../utils'
import { AbstractEngine } from './abstract-engine'
import { IMessageRequest, IModel } from './interfaces'

const sourceLangMap: Record<string, string> = {
    'bg': 'BG',
    'cs': 'CS',
    'da': 'DA',
    'de': 'DE',
    'el': 'EL',
    'en': 'EN',
    'en-US': 'EN',
    'en-GB': 'EN',
    'en-CA': 'EN',
    'en-AU': 'EN',
    'es': 'ES',
    'et': 'ET',
    'fi': 'FI',
    'fr': 'FR',
    'hu': 'HU',
    'id': 'ID',
    'it': 'IT',
    'ja': 'JA',
    'ko': 'KO',
    'lt': 'LT',
    'lv': 'LV',
    'nl': 'NL',
    'pl': 'PL',
    'pt': 'PT',
    'ro': 'RO',
    'ru': 'RU',
    'sk': 'SK',
    'sl': 'SL',
    'sv': 'SV',
    'tr': 'TR',
    'uk': 'UK',
    'zh': 'ZH',
    'zh-Hans': 'ZH',
    'zh-Hant': 'ZH',
}

const targetLangMap: Record<string, string> = {
    'bg': 'BG',
    'cs': 'CS',
    'da': 'DA',
    'de': 'DE',
    'el': 'EL',
    'en': 'EN-US',
    'en-US': 'EN-US',
    'en-GB': 'EN-GB',
    'en-CA': 'EN-US',
    'en-AU': 'EN-US',
    'es': 'ES',
    'et': 'ET',
    'fi': 'FI',
    'fr': 'FR',
    'hu': 'HU',
    'id': 'ID',
    'it': 'IT',
    'ja': 'JA',
    'ko': 'KO',
    'lt': 'LT',
    'lv': 'LV',
    'nl': 'NL',
    'pl': 'PL',
    'pt': 'PT-PT',
    'ro': 'RO',
    'ru': 'RU',
    'sk': 'SK',
    'sl': 'SL',
    'sv': 'SV',
    'tr': 'TR',
    'uk': 'UK',
    'zh': 'ZH',
    'zh-Hans': 'ZH',
    'zh-Hant': 'ZH',
}

function mapLanguage(map: Record<string, string>, lang?: string) {
    if (!lang) {
        return undefined
    }
    if (map[lang]) {
        return map[lang]
    }
    const normalized = lang.split('-')[0]
    return map[normalized]
}

export class DeepL extends AbstractEngine {
    async getModel(): Promise<string> {
        return 'deepl'
    }

    async listModels(): Promise<IModel[]> {
        return [
            {
                id: 'deepl',
                name: 'DeepL Translator',
            },
        ]
    }

    async sendMessage(req: IMessageRequest): Promise<void> {
        const settings = await getSettings()
        const apiKey = settings.deeplAPIKey?.trim()
        const meta = req.meta

        if (!apiKey) {
            req.onError('DeepL API Key is required.')
            return
        }

        if (!meta) {
            req.onError('DeepL provider requires translation metadata.')
            return
        }

        const { originalText, sourceLang, targetLang, mode } = meta

        if (mode !== 'translate') {
            req.onError('DeepL API currently only supports the Translate action.')
            return
        }

        if (!targetLang) {
            req.onError('Target language is required for DeepL translation.')
            return
        }

        if (!originalText) {
            req.onError('Text to translate is empty.')
            return
        }

        const deeplTargetLang = mapLanguage(targetLangMap, targetLang)
        if (!deeplTargetLang) {
            req.onError(`Unsupported target language for DeepL: ${targetLang}`)
            return
        }

        const deeplSourceLang = mapLanguage(sourceLangMap, sourceLang)
        if (sourceLang && !deeplSourceLang) {
            req.onError(`Unsupported source language for DeepL: ${sourceLang}`)
            return
        }

        const apiURL = (settings.deeplAPIURL || 'https://api-free.deepl.com').replace(/\/$/, '')
        const apiURLPath = settings.deeplAPIURLPath || '/v2/translate'
        const url = urlJoin(apiURL, apiURLPath)

        const body = new URLSearchParams()
        body.append('text', originalText)
        body.append('target_lang', deeplTargetLang)
        if (deeplSourceLang) {
            body.append('source_lang', deeplSourceLang)
        }
        body.append('split_sentences', 'nonewlines')
        body.append('preserve_formatting', '1')

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
        }

        const fetcher = getUniversalFetch()

        try {
            const resp = await fetcher(url, {
                method: 'POST',
                headers,
                body: body.toString(),
                signal: req.signal,
            })

            req.onStatusCode?.(resp.status)

            if (!resp.ok) {
                let errorMessage = `DeepL API request failed with status ${resp.status}`
                try {
                    const data = await resp.json()
                    if (data?.message) {
                        errorMessage = data.message
                    }
                } catch (e) {
                    try {
                        const text = await resp.text()
                        if (text) {
                            errorMessage = text
                        }
                    } catch {
                        // ignore
                    }
                }
                req.onError(errorMessage)
                return
            }

            const data = await resp.json()
            const translations: string[] = data?.translations?.map((item: { text: string }) => item.text) ?? []
            if (translations.length === 0) {
                req.onError('DeepL API returned an empty response.')
                return
            }

            const content = translations.join('\n')
            await req.onMessage({ content, role: '', isFullText: true })
            req.onFinished('stop')
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return
            }
            req.onError(error instanceof Error ? error.message : 'Unknown error')
        }
    }
}
