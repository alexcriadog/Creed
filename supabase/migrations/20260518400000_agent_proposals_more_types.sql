-- Amplía el CHECK constraint de agent_proposals.proposal_type para incluir
-- los dos tipos nuevos añadidos en sprints anteriores pero que faltaba
-- registrar a nivel de BD: 'training_program' y 'session_update'.
-- Sin esto, el coach no puede insertar propuestas de plan ni de ajustes.

alter table agent_proposals
  drop constraint if exists agent_proposals_proposal_type_check;

alter table agent_proposals
  add constraint agent_proposals_proposal_type_check
  check (proposal_type in (
    'training_session',
    'meal_target',
    'weight_target',
    'training_program',
    'session_update'
  ));
