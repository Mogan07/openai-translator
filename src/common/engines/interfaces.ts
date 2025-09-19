export interface IModel {
    id: string
    name: string
    description?: string
}

export interface IMessage {
    role: string
    content: string
}

export interface IMessageRequestMeta {
    originalText?: string
    sourceLang?: string
    targetLang?: string
    mode?: string
    writing?: boolean
    selectedWord?: string
}

export interface IMessageRequest {
    rolePrompt: string
    commandPrompt: string
    onMessage: (message: { content: string; role: string; isFullText?: boolean }) => Promise<void>
    onError: (error: string) => void
    onFinished: (reason: string) => void
    onStatusCode?: (statusCode: number) => void
    signal: AbortSignal
    meta?: IMessageRequestMeta
}

export interface IEngine {
    checkLogin: () => Promise<boolean>
    isLocal(): boolean
    supportCustomModel(): boolean
    getModel(): Promise<string>
    listModels(apiKey: string | undefined): Promise<IModel[]>
    sendMessage(req: IMessageRequest): Promise<void>
}
