import { supabase } from '../config/supabase';

interface LogAuditParams {
  userId: string;
  userEmail: string;
  userName: string;
  actionType: string;
  title: string;
  description: string;
}

export const logAuditAction = async (params: LogAuditParams) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: params.userId,
      user_email: params.userEmail,
      user_name: params.userName,
      action_type: params.actionType,
      title: params.title,
      description: params.description,
    });
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
  }
};

