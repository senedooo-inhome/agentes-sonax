export type Nullable<T> = T | null

export type CargoAgente = string

export type NichoAgente = string

export interface AgenteInfo {
  id: string

  nome_completo: string
  nome_abreviado: Nullable<string>

  carga_horaria: Nullable<string>

  cargo: Nullable<string>

  cep: Nullable<string>
  endereco: Nullable<string>
  cidade: Nullable<string>
  estado: Nullable<string>

  data_admissao: Nullable<string>
  data_nascimento: Nullable<string>

  dependentes: Nullable<number>

  nicho: Nullable<string>

  previsao_ferias: Nullable<string>
  dias_ferias: Nullable<number>

  ramal: Nullable<string>
  telefone: Nullable<string>

  created_at?: string
  updated_at?: string
}