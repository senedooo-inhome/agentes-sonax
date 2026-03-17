export type Nullable<T> = T | null

export type CargoAgente =
  | 'TELEFONISTA'
  | 'SUPERVISOR'
  | 'LIDER'
  | 'CEO'
  | 'COORDENADOR'

export type NichoAgente =
  | 'SAC'
  | 'CLINICA'

export interface AgenteInfo {
  id: string

  nome_completo: string
  nome_abreviado: Nullable<string>

  carga_horaria: Nullable<string>

  cargo: Nullable<CargoAgente>

  cep: Nullable<string>
  endereco: Nullable<string>
  cidade: Nullable<string>
  estado: Nullable<string>

  data_admissao: Nullable<string>
  data_nascimento: Nullable<string>

  dependentes: Nullable<number>

  nicho: Nullable<NichoAgente>

  previsao_ferias: Nullable<string>
  dias_ferias: Nullable<number>

  ramal: Nullable<string>
  telefone: Nullable<string>

  created_at?: string
  updated_at?: string
}