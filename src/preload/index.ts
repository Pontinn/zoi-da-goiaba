import { contextBridge } from 'electron'

// Esqueleto da API exposta ao renderer. A superficie completa (secao 5.B da SPEC)
// e preenchida no Sprint 2.
const api = {}

contextBridge.exposeInMainWorld('zoi', api)
