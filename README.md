# FreteHub MVP - Gestão de Fretes

MVP em HTML, CSS e JavaScript puro usando Firebase Auth + Firestore. Esta versão melhora a UX com navegação por abas, layout responsivo, dados reais em tempo real, localização do caminhoneiro, avaliações públicas e remoção de upload de documentos para manter o projeto adequado ao plano Spark.

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

## Principais mudanças desta versão

- O menu do gestor e do caminhoneiro agora troca seções por abas, sem deixar tudo enfileirado para baixo.
- No mobile, a navegação vira uma barra inferior mais intuitiva.
- O `index.html` mostra dados reais em tempo real:
  - fretes ativos;
  - caminhoneiros cadastrados;
  - veículos cadastrados.
- API do IBGE mantida para seleção de estado e cidade.
- Cadastro de frete tem campos privados:
  - endereço completo da coleta;
  - nome do contato;
  - telefone do contato.
- O caminhoneiro só vê endereço e contato depois que o gestor libera a candidatura.
- Depois da liberação, o caminhoneiro pode abrir a rota no Google Maps ou Waze.
- Depois da liberação, o caminhoneiro pode iniciar envio de localização em tempo real.
- O gestor visualiza as últimas posições em `Rastreamento`.
- O caminhoneiro pode avaliar o app.
- Avaliações públicas aparecem em tempo real no `index.html`.
- Upload de documentos foi removido para evitar uso de Firebase Storage.

## Coleções do Firestore

### usuarios/{uid}

```js
{
  nome: "Administrador",
  email: "admin@email.com",
  telefone: "53999999999",
  tipo: "gestor" // ou "caminhoneiro"
}
```

O código aceita tanto `tipo` quanto `role`, mas recomenda-se usar `tipo`.

### caminhoneiros/{uid}

Criado automaticamente no cadastro de caminhoneiro.

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

```js
{
  origem: { cidade: "Pelotas", uf: "RS", estado: "Rio Grande do Sul", texto: "Pelotas - RS" },
  destino: { cidade: "Porto Alegre", uf: "RS", estado: "Rio Grande do Sul", texto: "Porto Alegre - RS" },
  originText: "Pelotas - RS",
  destinationText: "Porto Alegre - RS",
  cargoType: "Grãos",
  weight: 12000,
  price: 2500,
  deadline: "2026-04-30",
  vehicleType: "Truck",
  description: "Descrição pública",
  pickupAddress: "Endereço privado do local de coleta",
  pickupContactName: "Nome do contato",
  pickupContactPhone: "Telefone do contato",
  status: "aberto" // aberto, em_andamento, finalizado
}
```

### fretes/{freightId}/candidaturas/{driverUid}

```js
{
  freightId: "...",
  driverId: "...",
  driverName: "Nome",
  vehicleLabel: "Truck Modelo • Placa",
  status: "pendente" // pendente, liberado, recusado
}
```

Quando o gestor libera, os dados privados do local são espelhados na candidatura do caminhoneiro.

### caminhoneiros/{uid}/minhasCandidaturas/{freightId}

Espelho da candidatura para facilitar a tela do caminhoneiro.

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

## Observação importante sobre privacidade

Nesta versão, a interface só mostra endereço e contato depois da liberação. Para uma proteção forte no Firestore, use regras separando permissões de gestor e caminhoneiro aprovado. Em produção, o ideal é mover detalhes privados para uma subcoleção protegida por regras, por exemplo:

```text
fretes/{freightId}/privado/detalhes
```

Como este MVP usa apenas front-end estático, mantenha regras conservadoras antes de publicar dados reais.

## Regras iniciais sugeridas para desenvolvimento

Use regras mais restritas em produção. Este exemplo é um ponto de partida para testar o MVP com usuários autenticados.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    match /usuarios/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    match /caminhoneiros/{driverId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == driverId;

      match /veiculos/{vehicleId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn() && request.auth.uid == driverId;
      }

      match /minhasCandidaturas/{freightId} {
        allow read, write: if isSignedIn() && request.auth.uid == driverId;
      }
    }

    match /fretes/{freightId} {
      allow read: if isSignedIn() || true;
      allow create, update, delete: if isSignedIn();

      match /candidaturas/{driverId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn();
      }

      match /rastreamento/{driverId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn() && request.auth.uid == driverId;
      }
    }

    match /avaliacoes/{reviewId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.driverId;
    }
  }
}
```

## Como rodar

1. Abra a pasta no VS Code.
2. Use a extensão Live Server ou outro servidor local.
3. Abra `index.html`.
4. Crie o gestor no Firebase Authentication.
5. Crie manualmente `usuarios/{UID_DO_GESTOR}` no Firestore com:

```js
{
  nome: "Administrador",
  email: "seu-email@email.com",
  telefone: "53999999999",
  tipo: "gestor"
}
```

O ID do documento em `usuarios` precisa ser o mesmo UID do usuário no Authentication.

## Localização em tempo real

A localização usa `navigator.geolocation.watchPosition`. O navegador só permite isso em ambiente seguro:

- `https://` em produção; ou
- `localhost` durante desenvolvimento.

O caminhoneiro precisa permitir a localização no navegador. O gestor verá a última posição na aba `Rastreamento`.
