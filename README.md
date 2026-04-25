# FreteHub - Gestao de Fretes

Sistema web em HTML, CSS e JavaScript com Firebase Auth e Firestore. A versao foi lapidada para operar com custo zero: sem Firebase Storage, sem Cloud Functions, sem mapa pago embutido e sem upload de documentos.

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
