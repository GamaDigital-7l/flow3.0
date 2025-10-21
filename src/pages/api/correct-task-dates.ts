import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { convertToSaoPauloTime, convertToUtc } from '@/lib/utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { data: tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, due_date, created_at, last_successful_completion_date');

    if (fetchError) {
      console.error('Erro ao buscar tarefas:', fetchError);
      return res.status(500).json({ message: 'Erro ao buscar tarefas', error: fetchError.message });
    }

    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ message: 'Nenhuma tarefa encontrada para corrigir.' });
    }

    for (const task of tasks) {
      let updatedDueDate = task.due_date;
      let updatedCreatedAt = task.created_at;
      let updatedLastCompletionDate = task.last_successful_completion_date;

      if (task.due_date) {
        const saoPauloDueDate = convertToSaoPauloTime(task.due_date);
        if (saoPauloDueDate) {
          updatedDueDate = format(saoPauloDueDate, 'yyyy-MM-dd');
        }
      }

      if (task.created_at) {
        const saoPauloCreatedAt = convertToSaoPauloTime(task.created_at);
        if (saoPauloCreatedAt) {
          updatedCreatedAt = formatISO(saoPauloCreatedAt);
        }
      }

      if (task.last_successful_completion_date) {
        const saoPauloLastCompletionDate = convertToSaoPauloTime(task.last_successful_completion_date);
        if (saoPauloLastCompletionDate) {
          updatedLastCompletionDate = format(saoPauloLastCompletionDate, 'yyyy-MM-dd');
        }
      }

      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          due_date: updatedDueDate,
          created_at: updatedCreatedAt,
          last_successful_completion_date: updatedLastCompletionDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (updateError) {
        console.error(`Erro ao atualizar tarefa ${task.id}:`, updateError);
      }
    }

    return res.status(200).json({ message: 'Datas das tarefas corrigidas com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao corrigir datas das tarefas:', error);
    return res.status(500).json({ message: 'Erro ao corrigir datas das tarefas', error: error.message });
  }
}