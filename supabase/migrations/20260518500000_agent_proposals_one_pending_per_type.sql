-- Garantía a nivel de BD: no puede haber más de UNA propuesta `pending` del
-- mismo proposal_type en la misma conversación. Esto pone una red de
-- seguridad contra el caso en que el modelo dispara propose_training_program
-- (u otro tool propose_*) dos veces seguidas en el mismo turno.

create unique index if not exists agent_proposals_conv_type_pending_unique
  on agent_proposals (conversation_id, proposal_type)
  where status = 'pending' and conversation_id is not null;
