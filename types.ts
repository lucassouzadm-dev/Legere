// ─── Enums de Usuário ─────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  LAWYER = 'LAWYER',
  INTERN = 'INTERN',
  FINANCE = 'FINANCE',
  RECEPTION = 'RECEPTION'
}

export enum UserStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED'
}

// ─── Enums de Processo / Cliente ─────────────────────────────────────────────

export enum ClientStatus {
  LEAD = 'LEAD',
  PROSPECT = 'PROSPECTO',
  CONTRACT_SENT = 'CONTRATO_ENVIADO',
  ACTIVE = 'ATIVO',
  INACTIVE = 'INATIVO',
  EX_CLIENT = 'EX_CLIENTE'
}

export enum CaseStatus {
  ONGOING = 'ONGOING',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
  WON = 'WON',
  LOST = 'LOST',
  SETTLEMENT = 'SETTLEMENT'
}

export enum Priority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum TransactionStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FUTURE = 'FUTURE'
}

export enum HearingStatus {
  SCHEDULED  = 'SCHEDULED',
  COMPLETED  = 'COMPLETED',
  CANCELLED  = 'CANCELLED',
  POSTPONED  = 'POSTPONED',
}

export enum HearingModality {
  PRESENCIAL       = 'PRESENCIAL',
  VIDEOCONFERENCIA = 'VIDEOCONFERENCIA',
}

// ─── SaaS: Planos ─────────────────────────────────────────────────────────────

export enum PlanType {
  ESSENCIAL    = 'ESSENCIAL',
  PROFISSIONAL = 'PROFISSIONAL',
  ENTERPRISE   = 'ENTERPRISE',
}

export interface PlanFeatures {
  maxUsers: number;           // -1 = ilimitado
  maxClients: number;         // -1 = ilimitado
  djenAutoSync: boolean;
  aiPetitionGenerator: boolean;
  clientPortal: boolean;
  whatsappIntegration: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  multiUnit: boolean;
  prioritySupport: boolean;
}

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  [PlanType.ESSENCIAL]: {
    maxUsers: 3,
    maxClients: 100,
    djenAutoSync: false,
    aiPetitionGenerator: false,
    clientPortal: false,
    whatsappIntegration: false,
    advancedReports: false,
    apiAccess: false,
    multiUnit: false,
    prioritySupport: false,
  },
  [PlanType.PROFISSIONAL]: {
    maxUsers: 10,
    maxClients: -1,
    djenAutoSync: true,
    aiPetitionGenerator: true,
    clientPortal: true,
    whatsappIntegration: false,
    advancedReports: true,
    apiAccess: false,
    multiUnit: false,
    prioritySupport: false,
  },
  [PlanType.ENTERPRISE]: {
    maxUsers: -1,
    maxClients: -1,
    djenAutoSync: true,
    aiPetitionGenerator: true,
    clientPortal: true,
    whatsappIntegration: true,
    advancedReports: true,
    apiAccess: true,
    multiUnit: true,
    prioritySupport: true,
  },
};

export const PLAN_PRICES: Record<PlanType, number> = {
  [PlanType.ESSENCIAL]:    79,
  [PlanType.PROFISSIONAL]: 129,
  [PlanType.ENTERPRISE]:   199,
};

export const PLAN_LABELS: Record<PlanType, string> = {
  [PlanType.ESSENCIAL]:    'Essencial',
  [PlanType.PROFISSIONAL]: 'Profissional',
  [PlanType.ENTERPRISE]:   'Enterprise',
};

// ─── Permissões por Perfil ────────────────────────────────────────────────────

export interface RoleModulePermissions {
  dashboard:    boolean;
  calendar:     boolean;
  crm:          boolean;
  cases:        boolean;
  deadlines:    boolean;
  hearings:     boolean;
  tasks:        boolean;
  ia:           boolean;
  finance:      boolean;
  chat:         boolean;
  publications: boolean;
  whatsapp_crm: boolean;
  settings:     boolean;
}

export interface RolePermissions {
  modules: RoleModulePermissions;
  canViewFinancialValues: boolean;   // se false, valores monetários são mascarados
}

/** Permissões por perfil, salvas por tenant */
export type TenantRolePermissions = Record<UserRole, RolePermissions>;

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantIntegrations {
  // ── Google Gemini ──────────────────────────────────────────────────────────
  geminiApiKey?: string;

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  whatsappMethod?: 'qrcode' | 'meta_api';

  // QR Code via Evolution API (método recomendado — sem necessidade de aprovação Meta)
  evolutionApiUrl?: string;        // ex: https://evo.seudominio.com
  evolutionApiKey?: string;        // chave da instância Evolution
  evolutionInstance?: string;      // nome da instância (ex: "juriscloud-oab123")

  // Meta Business API (método oficial)
  metaPhoneNumberId?: string;      // Phone Number ID do Meta Developer Portal
  metaAccessToken?: string;        // Token de acesso permanente do Meta
  metaVerifyToken?: string;        // Token de verificação do webhook (gerado automaticamente)
}

export interface Tenant {
  id: string;
  name: string;
  slogan?: string;
  cnpj?: string;
  phone?: string;
  email: string;
  plan: PlanType;
  logoUrl?: string;
  createdAt: string;
  active: boolean;
  trialEndsAt?: string;
  integrations?: TenantIntegrations;
}

// ─── Interfaces de Dados ──────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  monthlyGoal: number;
  avatar?: string;
  password?: string;
  oabNumber?: string;
  oabState?: string;
  tenantId: string;
}

export interface Comment {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  attachment?: { data: string; name: string; type: string; size: number; };
}

export interface ServiceLog {
  id: string;
  date: string;
  content: string;
  authorName: string;
  tag?: string;
}

export interface ClientNotice {
  id: string;
  content: string;
  date?: string;
  createdAt: string;
}

export interface ClientDocument {
  id: string;
  name: string;
  date: string;
  type: string;
  status: string;
  content?: string;
  sentBy: 'OFFICE' | 'CLIENT';
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'IN' | 'OUT';
  category: string;
  date: string;
  status: TransactionStatus;
  hasAttachment: boolean;
  attachmentData?: string;
  attachmentName?: string;
  professionalId?: string;
  clientId?: string;
  clientName?: string;
  tenantId: string;
}

export interface Task {
  id: string;
  title: string;
  client: string;
  priority: Priority;
  deadline: string;
  status: string;
  responsible: string;
  createdBy?: string;
  comments?: Comment[];
  tenantId: string;
}

export interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  document: string;
  email: string;
  phone: string;
  status: ClientStatus;
  createdAt: string;
  tags: string[];
  score: number;
  birthDate?: string;
  lastContactDate?: string;
  area?: string;
  totalContract: number;
  totalPaid: number;
  documents?: ClientDocument[];
  serviceLogs?: ServiceLog[];
  notices?: ClientNotice[];
  tenantId: string;
}

export interface Hearing {
  id: string;
  date: string;
  time: string;
  processNumber: string;
  parties: string;
  modality: HearingModality;
  link?: string;
  location?: string;
  responsibleId?: string;
  responsibleName: string;
  status: HearingStatus;
  notes?: string;
  publicationId?: string;
  caseId?: string;
  clientName?: string;
  notified5d?: boolean;
  notified1d?: boolean;
  notified3h?: boolean;
  createdAt: string;
  tenantId: string;
}

export interface Case {
  id: string;
  cnj: string;
  title: string;
  clientId: string;
  clientName: string;
  area: string;
  court: string;
  status: CaseStatus;
  lawyerId: string;
  value: number;
  probability: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  nextDeadline?: string;
  createdAt: string;
  distributionDate: string;
  tenantId: string;
}
