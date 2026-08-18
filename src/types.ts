export interface Student {
  id: string;
  name?: string;
  phone?: string;
  className?: string;
  grade?: string;
  notes?: string;
  [key: string]: any; // Allow other Excel columns dynamically
}

export interface WhatsAppConfig {
  mode: "simulated" | "real" | "cloud_api";
  simulatedStatus: "disconnected" | "qr_ready" | "connecting" | "connected";
  simulatedPhone: string;
  hasCloudApiKey: boolean;
  cloudPhoneId: string;
  cloudAccountId: string;
}

export interface CampaignLog {
  id: string;
  studentName: string;
  phone: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "completed" | "paused";
  startTime: string | null;
  endTime: string | null;
  logs?: CampaignLog[];
}
