# FreteHub - Gestao de Fretes

Sistema web em HTML, CSS e JavaScript com Firebase Auth e Firestore. A versao foi lapidada para operar com custo zero: sem Firebase Storage, sem Cloud Functions, sem mapa pago embutido e sem upload de documentos.

## Licenca de uso privado

Este repositorio, seu codigo-fonte, telas, estrutura de dados, fluxos operacionais, identidade do produto e documentacao sao de uso privado e exclusivo do titular/autorizado. Nao e permitido copiar, vender, sublicenciar, redistribuir, publicar, transferir, hospedar para terceiros, disponibilizar como template, remover creditos ou criar obra derivada sem autorizacao expressa e por escrito.

O acesso ao projeto nao concede cessao de direitos autorais ou propriedade intelectual. O uso permitido fica limitado a operacao privada do sistema FreteHub pelo titular do projeto. Qualquer uso comercial por terceiros, replicacao parcial ou total, engenharia reversa com finalidade de distribuicao ou reaproveitamento do repositorio depende de licenca contratual especifica.

Ao acessar, executar ou modificar este codigo, o usuario declara ciencia de que o projeto e privado e protegido por direito autoral.

## Arquivos principais

```text
index.html
login.html
cadastro-caminhoneiro.html
cadastro-empresa.html
gestor.html
caminhoneiro.html
empresa.html
acompanhar.html
validar.html
recibo.html

css/
  home.css
  auth.css
  dashboard.css

js/
  firebase.js
  ibge.js
  ui.js
  comercial.js
  home.js
  auth.js
  gestor.js
  caminhoneiro.js
  empresa.js
  acompanhar.js
  validar.js
  recibo.js
```

## Regras do Firestore

Cole em `Firebase Console > Firestore Database > Rules` e publique.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signed() { return request.auth != null; }
    function userData() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
    function role() { return signed() ? (userData().tipo == null ? userData().role : userData().tipo) : null; }
    function gestor() { return signed() && role() == "gestor"; }
    function empresa() { return signed() && role() == "empresa"; }
    function caminhoneiro() { return signed() && role() == "caminhoneiro"; }
    function ownsFreight(fid) { return signed() && get(/databases/$(database)/documents/fretes/$(fid)).data.empresaId == request.auth.uid; }
    function selectedDriver(fid) { return signed() && get(/databases/$(database)/documents/fretes/$(fid)).data.selectedDriverId == request.auth.uid; }

    match /publico/{docId} {
      allow read: if true;
      allow write: if gestor();
    }

    match /usuarios/{userId} {
      allow read: if signed();
      allow create: if signed() && request.auth.uid == userId;
      allow update: if gestor() || request.auth.uid == userId;
      allow delete: if gestor();
    }

    match /empresas/{empresaId} {
      allow read: if signed();
      allow create, update: if gestor() || request.auth.uid == empresaId;
      allow delete: if gestor();

      match /contatos/{contactId} {
        allow read, write: if gestor() || request.auth.uid == empresaId;
      }

      match /locais/{placeId} {
        allow read, write: if gestor() || request.auth.uid == empresaId;
      }
    }

    match /conversas/{conversaId} {
      allow read: if gestor() || request.auth.uid == resource.data.empresaId || request.auth.uid == conversaId;
      allow create: if signed();
      allow update: if gestor() || request.auth.uid == resource.data.empresaId || request.auth.uid == conversaId;
      allow delete: if gestor();

      match /mensagens/{mensagemId} {
        allow read: if gestor() || request.auth.uid == get(/databases/$(database)/documents/conversas/$(conversaId)).data.empresaId || request.auth.uid == conversaId;
        allow create: if gestor() || request.auth.uid == get(/databases/$(database)/documents/conversas/$(conversaId)).data.empresaId || request.auth.uid == conversaId;
        allow update, delete: if gestor();
      }
    }

    match /caminhoneiros/{driverId} {
      allow read: if signed();
      allow create, update: if gestor() || request.auth.uid == driverId;
      allow delete: if gestor();

      match /veiculos/{vehicleId} {
        allow read: if signed();
        allow create, update, delete: if gestor() || request.auth.uid == driverId;
      }

      match /minhasCandidaturas/{freightId} {
        allow read, write: if gestor() || request.auth.uid == driverId;
      }

      match /tagsInternas/{tagId} {
        allow read, write: if gestor();
      }
    }

    match /fretes/{freightId} {
      allow read: if true;
      allow create: if gestor() || (empresa() && request.resource.data.empresaId == request.auth.uid);
      allow update: if gestor() || ownsFreight(freightId) || selectedDriver(freightId);
      allow delete: if gestor();

      match /privado/{docId} {
        allow read, write: if gestor() || ownsFreight(freightId);
      }

      match /candidaturas/{driverId} {
        allow read: if gestor() || ownsFreight(freightId) || request.auth.uid == driverId;
        allow create: if caminhoneiro() && request.auth.uid == driverId && request.resource.data.driverId == request.auth.uid;
        allow update: if gestor() || ownsFreight(freightId) || request.auth.uid == driverId;
        allow delete: if gestor();
      }

      match /rastreamento/{driverId} {
        allow read: if gestor() || ownsFreight(freightId) || request.auth.uid == driverId;
        allow create, update: if caminhoneiro() && request.auth.uid == driverId;
        allow delete: if gestor() || request.auth.uid == driverId;
      }

      match /eventos/{eventId} {
        allow read: if true;
        allow create: if signed();
        allow update, delete: if gestor();
      }
    }

    match /comissoes/{commissionId} {
      allow read: if gestor() || (signed() && resource.data.empresaId == request.auth.uid);
      allow create: if gestor() || (empresa() && request.resource.data.empresaId == request.auth.uid);
      allow update: if gestor() || (empresa() && resource.data.empresaId == request.auth.uid);
      allow delete: if gestor();
    }

    match /contatos/{contactId} {
      allow create: if signed();
      allow read, update, delete: if gestor();
    }

    match /notificacoes/{userId}/items/{itemId} {
      allow read, update, delete: if signed() && request.auth.uid == userId;
      allow create: if signed();
    }

    match /avaliacoes/{reviewId} {
      allow read: if gestor() || (signed() && resource.data.driverId == request.auth.uid) || resource.data.publico == true;
      allow create: if signed() && request.resource.data.driverId == request.auth.uid;
      allow update, delete: if gestor() || (signed() && resource.data.driverId == request.auth.uid);
    }
  }
}
```

## Melhorias aplicadas

1. Aceite de comissao no cadastro da empresa.
2. Termo de uso para caminhoneiro.
3. Cadeado comercial na liberacao do frete.
4. Registro de contatos feitos por WhatsApp.
5. Botao de confirmar contratacao pela empresa.
6. Painel financeiro de comissoes com indicadores.
7. Recibo imprimivel de comissao.
8. Pagina publica `validar.html` para validar codigo do frete.
9. Protecao dos dados sensiveis antes da liberacao.
10. Base para reputacao dos dois lados.
11. Tags internas e penalidades operacionais.
12. Links de convite com parametro `ref`.
13. Registro da origem do cadastro.
14. Secao comercial para empresas na home.
15. Secao comercial para caminhoneiros na home.
16. Botoes principais `Tenho carga` e `Sou caminhoneiro`.
17. Painel de qualidade dos dados no gestor.
18. Disponibilidade por cidade e preferencias de rota/carga.
19. Mensagens prontas para divulgar e contatar pelo WhatsApp.
20. Template de cobranca de comissao por WhatsApp.
21. Destaque de comissao pendente por frete.
22. Exportacao CSV.
23. Backup manual em JSON.
24. Pagina/aba de ajuda dentro do painel.
25. Identidade visual e textos mais comerciais.
26. Home com consulta de codigo em modal.
27. Chat interno entre empresa e gestor, organizado por empresa.
28. Pagina da empresa ampliada com contatos operacionais, locais frequentes, perfil editavel e proximas acoes.
29. Estados vazios e layout de conversa com comportamento responsivo.

## Usuario gestor manual

Crie o usuario em Authentication e depois crie o documento `usuarios/{UID}`:

```js
{
  nome: "Administrador",
  email: "seu@email.com",
  telefone: "53999932927",
  tipo: "gestor",
  role: "gestor"
}
```

---

## Licença de uso privado e propriedade do repositório

Este projeto é de uso privado e exclusivo do titular/autorizado pelo proprietário do FreteHub. O código-fonte, telas, fluxos, textos, estrutura de dados, regras de segurança, identidade do produto e lógica comercial não podem ser copiados, vendidos, redistribuídos, publicados, sublicenciados, compartilhados como template, usados como base para outro sistema ou incorporados em produto de terceiros sem autorização expressa e por escrito do proprietário.

A autorização de uso, quando concedida, é limitada ao ambiente e finalidade aprovados pelo proprietário. Qualquer uso fora desse escopo exige nova autorização. A remoção deste aviso, alteração da autoria ou tentativa de redistribuição do projeto não concede direito de uso.

## Melhorias aplicadas nesta versão

- Portais públicos separados para empresas e caminhoneiros.
- Página "Como funciona" explicando empresa, caminhoneiro, gestor, comissão e código do frete.
- Onboarding guiado para empresa e caminhoneiro.
- Checklist de perfil completo com barra de progresso.
- Central de notificações no gestor, empresa e caminhoneiro.
- Painel "Atenção agora" e modo operação do dia para o gestor.
- Status com próxima ação operacional.
- Agenda de coletas e entregas.
- Notas, etiquetas e histórico por auditoria operacional.
- Motivos padronizados de cancelamento previstos na estrutura.
- Relatório de conversão.
- Ranking comercial de empresas e ranking operacional de caminhoneiros.
- Comprovante de intermediação imprimível.
- Assinatura digital simples prevista no fluxo de confirmação.
- PIN de coleta e entrega previsto no modelo de frete.
- Auditoria de ações relevantes.
- Modo demonstração em `demo.html`.
- Página de apresentação comercial imprimível em `apresentacao.html`.
- Mensagens comerciais prontas com botão copiar.
- Configurações da plataforma em `configuracoes/plataforma`.
- Estrutura preparada para níveis de permissão: `gestor_admin`, `gestor_operacional`, `empresa_admin`, `empresa_operacional`, `caminhoneiro`.

## Regras Firestore recomendadas para esta versão

Publique estas regras no Firebase Console > Firestore Database > Rules.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function userDoc() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)); }
    function userType() { return signedIn() && userDoc().data.tipo != null ? userDoc().data.tipo : signedIn() ? userDoc().data.role : null; }
    function isGestor() { return signedIn() && (userType() == 'gestor' || userType() == 'gestor_admin' || userType() == 'gestor_operacional'); }
    function isEmpresa() { return signedIn() && (userType() == 'empresa' || userType() == 'empresa_admin' || userType() == 'empresa_operacional'); }
    function isDriver() { return signedIn() && userType() == 'caminhoneiro'; }
    function owns(id) { return signedIn() && request.auth.uid == id; }

    match /usuarios/{uid} {
      allow create: if signedIn() && owns(uid);
      allow read: if signedIn() && (owns(uid) || isGestor());
      allow update: if signedIn() && (owns(uid) || isGestor());
    }

    match /empresas/{empresaId} {
      allow read: if signedIn() && (isGestor() || owns(empresaId) || isDriver());
      allow create, update: if signedIn() && (isGestor() || owns(empresaId));
      match /contatos/{docId} { allow read, write: if signedIn() && (isGestor() || owns(empresaId)); }
      match /locais/{docId} { allow read, write: if signedIn() && (isGestor() || owns(empresaId)); }
      match /notasInternas/{docId} { allow read, write: if isGestor(); }
      match /tagsInternas/{docId} { allow read, write: if isGestor(); }
    }

    match /caminhoneiros/{driverId} {
      allow read: if signedIn();
      allow create, update: if signedIn() && (owns(driverId) || isGestor());
      match /veiculos/{vehicleId} { allow read: if signedIn() && (isGestor() || owns(driverId)); allow write: if signedIn() && (owns(driverId) || isGestor()); }
      match /minhasCandidaturas/{applicationId} { allow read, write: if signedIn() && (owns(driverId) || isGestor()); }
      match /tagsInternas/{docId} { allow read, write: if isGestor(); }
      match /notasInternas/{docId} { allow read, write: if isGestor(); }
    }

    match /fretes/{freteId} {
      allow read: if true;
      allow create: if signedIn() && (isGestor() || isEmpresa());
      allow update: if signedIn() && (isGestor() || isEmpresa() || isDriver());
      match /privado/{docId} { allow read: if signedIn() && (isGestor() || isEmpresa() || isDriver()); allow write: if signedIn() && (isGestor() || isEmpresa()); }
      match /candidaturas/{candId} { allow read: if signedIn() && (isGestor() || isEmpresa() || isDriver()); allow create: if isDriver(); allow update: if signedIn() && (isGestor() || isEmpresa() || isDriver()); }
      match /eventos/{eventId} { allow read: if true; allow create: if signedIn(); allow update, delete: if isGestor(); }
      match /rastreamento/{trackId} { allow read: if signedIn() && (isGestor() || isEmpresa() || isDriver()); allow create, update: if signedIn() && (isGestor() || isDriver()); }
      match /assinaturas/{signatureId} { allow read: if signedIn(); allow create: if signedIn(); allow update, delete: if isGestor(); }
    }

    match /comissoes/{commissionId} { allow read: if signedIn() && (isGestor() || isEmpresa()); allow create, update: if signedIn() && (isGestor() || isEmpresa()); }
    match /conversas/{conversationId} { allow read, write: if signedIn() && (isGestor() || owns(conversationId)); match /mensagens/{messageId} { allow read, write: if signedIn() && (isGestor() || owns(conversationId)); } }
    match /notificacoes/{notificationId} { allow read, write: if signedIn(); }
    match /auditoria/{auditId} { allow read: if isGestor(); allow create: if signedIn(); allow update, delete: if isGestor(); }
    match /configuracoes/{configId} { allow read: if true; allow write: if isGestor(); }
    match /avaliacoes/{reviewId} { allow read: if true; allow create: if signedIn(); allow update, delete: if isGestor(); }
    match /contatos/{contactId} { allow read, write: if signedIn(); }
    match /publico/{docId} { allow read: if true; allow write: if isGestor(); }
  }
}
```

## Observação de compatibilidade

A versão continua sem Firebase Storage, sem Cloud Functions e sem API paga. O projeto usa Firebase Auth, Firestore, páginas HTML/CSS/JS e recursos gratuitos do navegador. Para preservar fluidez, as telas usam consultas limitadas, cards, estados vazios, filtros e carregamento por blocos.

## Atualização - 5 melhorias inteligentes

Esta versão adiciona cinco recursos operacionais mantendo compatibilidade com o plano gratuito:

1. **Central de negociação do frete**: registra propostas, contrapropostas e observações por frete.
2. **Score de confiabilidade automático**: calcula pontuação de empresas e caminhoneiros com base em histórico, dados completos, disponibilidade e cancelamentos.
3. **Mural de oportunidades para caminhoneiros**: destaca fretes por melhor valor, coleta hoje, mesmo estado e compatibilidade com veículo.
4. **Comparador de candidatos**: ajuda gestor e empresa a comparar candidatos por veículo, cidade, valor proposto, status e score.
5. **SLA e prazos operacionais**: mostra alertas de frete sem candidato, ausência de atualização, prazo vencido, operação do dia e comissão a conferir.

## Organização dos HTML

Somente `index.html` permanece na raiz. Todas as demais páginas ficam na pasta `pages/`.

```text
index.html
pages/login.html
pages/cadastro-caminhoneiro.html
pages/cadastro-empresa.html
pages/gestor.html
pages/empresa.html
pages/caminhoneiro.html
pages/acompanhar.html
pages/validar.html
pages/recibo.html
pages/comprovante.html
pages/empresas.html
pages/caminhoneiros.html
pages/como-funciona.html
pages/apresentacao.html
pages/demo.html
```

## Regras Firestore adicionais para negociação

Adicione às regras do Firestore, dentro de `match /databases/{database}/documents`:

```text
match /fretes/{freteId}/negociacoes/{negociacaoId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if isGestor();
}
```
