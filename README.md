# FreteHub - Gestão de Fretes

Sistema web em HTML, CSS e JavaScript usando Firebase Auth, Firestore e API do IBGE para seleção de estados e cidades.

## Estrutura

```text
index.html
login.html
cadastro-caminhoneiro.html
gestor.html
caminhoneiro.html

css/
  home.css
  auth.css
  dashboard.css

js/
  firebase.js
  ibge.js
  ui.js
  home.js
  auth.js
  gestor.js
  caminhoneiro.js
```

## Regras do Firestore

Cole estas regras em `Firebase Console > Firestore Database > Rules`, clique em **Publicar** e recarregue o site.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid));
    }

    function isGestor() {
      return isSignedIn() &&
        (userDoc().data.tipo == "gestor" || userDoc().data.role == "gestor");
    }

    function isDriver(driverId) {
      return isSignedIn() && request.auth.uid == driverId;
    }

    match /publico/{docId} {
      allow read: if true;
      allow write: if isGestor();
    }

    match /usuarios/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && (request.auth.uid == userId || isGestor());
      allow update: if isGestor() || isDriver(userId);
      allow delete: if isGestor();
    }

    match /caminhoneiros/{driverId} {
      allow read: if isSignedIn();
      allow create, update: if isDriver(driverId) || isGestor();
      allow delete: if isGestor();

      match /veiculos/{vehicleId} {
        allow read: if isSignedIn();
        allow create, update, delete: if isDriver(driverId) || isGestor();
      }

      match /minhasCandidaturas/{freightId} {
        allow read, write: if isDriver(driverId) || isGestor();
      }
    }

    match /fretes/{freightId} {
      allow read: if true;
      allow create, update, delete: if isGestor();

      match /privado/{docId} {
        allow read, write: if isGestor();
      }

      match /candidaturas/{driverId} {
        allow read: if isGestor() || isDriver(driverId);
        allow create: if isDriver(driverId);
        allow update: if isGestor() || isDriver(driverId);
        allow delete: if isGestor();
      }

      match /rastreamento/{driverId} {
        allow read: if isGestor() || isDriver(driverId);
        allow create, update: if isDriver(driverId);
        allow delete: if isGestor() || isDriver(driverId);
      }
    }

    match /avaliacoes/{reviewId} {
      allow read: if isGestor() ||
        (isSignedIn() && resource.data.driverId == request.auth.uid) ||
        resource.data.publico == true;
      allow create: if isSignedIn() && request.resource.data.driverId == request.auth.uid;
      allow update, delete: if isGestor() ||
        (isSignedIn() && resource.data.driverId == request.auth.uid);
    }
  }
}
```

## Dados principais

### usuarios/{uid}

```js
{
  nome: "Administrador",
  email: "admin@email.com",
  telefone: "53999932927",
  tipo: "gestor"
}
```

O ID do documento em `usuarios` deve ser o mesmo UID do usuário no Firebase Authentication.

### caminhoneiros/{uid}/veiculos/{vehicleId}

```js
{
  plate: "ABC1D23",
  model: "Volvo FH",
  year: 2022,
  type: "Carreta",
  capacity: 28000,
  status: "ativo"
}
```

### fretes/{freightId}

Documento público do frete, sem endereço nem contato privado.

```js
{
  originText: "Pelotas - RS",
  destinationText: "Porto Alegre - RS",
  cargoType: "Grãos",
  weight: 12000,
  price: 2500,
  deadline: "2026-04-30",
  vehicleType: "Truck",
  description: "Carga paletizada",
  managerPhone: "53999932927",
  status: "aberto"
}
```

### fretes/{freightId}/privado/detalhes

Documento acessado somente pelo gestor.

```js
{
  pickupAddress: "Endereço completo da coleta",
  pickupContactName: "Contato no local",
  pickupContactPhone: "Telefone do contato",
  managerPhone: "53999932927"
}
```

Quando o gestor libera o caminhoneiro, o sistema copia estes dados para a candidatura aprovada do caminhoneiro.

### fretes/{freightId}/candidaturas/{driverUid}

```js
{
  freightId: "...",
  driverId: "...",
  driverName: "Nome",
  driverPhone: "53999999999",
  vehicleLabel: "Truck Modelo • Placa",
  status: "pendente"
}
```

### caminhoneiros/{uid}/minhasCandidaturas/{freightId}

Espelho da candidatura usado pelo painel do caminhoneiro.

### fretes/{freightId}/rastreamento/{driverUid}

```js
{
  freightId: "...",
  driverId: "...",
  driverName: "Nome",
  lat: -31.77,
  lng: -52.34,
  accuracy: 20,
  active: true,
  updatedAt: serverTimestamp()
}
```

### publico/resumo

Usado pelo `index.html` para mostrar os cards do resumo operacional.

```js
{
  fretesAtivos: 3,
  caminhoneiros: 12,
  veiculos: 18,
  updatedAt: serverTimestamp()
}
```

### avaliacoes/{reviewId}

```js
{
  driverId: "...",
  nome: "Nome do caminhoneiro",
  nota: 5,
  texto: "Comentário",
  publico: true,
  createdAt: serverTimestamp()
}
```

## Como rodar

1. Abra a pasta no VS Code.
2. Rode com Live Server ou outro servidor local.
3. Abra `index.html`.
4. Crie o usuário gestor no Firebase Authentication.
5. Crie `usuarios/{UID_DO_GESTOR}` no Firestore com `tipo: "gestor"`.

## Localização

A localização usa o recurso nativo do navegador. Para o pedido de permissão funcionar, rode em `https://` no domínio publicado ou em `localhost` durante o desenvolvimento.
