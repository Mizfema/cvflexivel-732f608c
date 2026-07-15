-- Job de reconciliação de pagamentos PaySuite (paliativo, 15/07/2026):
-- a entrega automática do webhook da PaySuite devolve 401 em toda transação
-- real testada (assinatura inválida do lado deles, confirmado reassinando
-- manualmente com o mesmo secret e o mesmo algoritmo documentado, que sempre
-- funciona). Enquanto o suporte deles não corrige, este cron chama
-- /api/reconcile-payments a cada 3 minutos para confirmar pagamentos
-- "pending" que a PaySuite já marcou como completed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secret guardado no Supabase Vault em vez de literal nesta migration —
-- inserido uma única vez via SQL Editor antes desta migration correr
-- (select vault.create_secret('<valor>', 'paysuite_reconcile_secret', ...)),
-- para o valor nunca aparecer no histórico do git.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reconcile-paysuite-payments') then
    perform cron.schedule(
      'reconcile-paysuite-payments',
      '*/3 * * * *',
      $job$
      select net.http_post(
        url := 'https://cvelite.lovable.app/api/reconcile-payments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-reconcile-secret', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'paysuite_reconcile_secret'
          )
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  end if;
end $$;
