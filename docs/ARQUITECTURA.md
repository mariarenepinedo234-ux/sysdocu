# Arquitectura y modelo de datos

La aplicación tiene un servidor Node.js/Express, una interfaz HTML/CSS/JavaScript sin compilación y una base SQLite. El servidor aplica autenticación y permisos en cada operación; ocultar un botón no es el mecanismo de autorización. Los archivos se sirven mediante rutas autenticadas y se almacenan con nombres aleatorios fuera de `public/`.

```mermaid
flowchart LR
  Navegador -->|Sesión HttpOnly, API JSON y multipart| Express
  Express -->|Consultas parametrizadas| SQLite
  Express -->|Archivos y versiones| Almacenamiento
  SQLite --> Instantanea[Instantánea SQLite]
  Instantanea --> Respaldo[ZIP con manifiesto SHA-256]
  Almacenamiento --> Respaldo
```

```mermaid
erDiagram
  AREAS ||--o{ USERS : asigna
  AREAS ||--o{ DOCUMENTS : clasifica
  USERS ||--o{ DOCUMENTS : registra
  CATEGORIES ||--o{ DOCUMENTS : organiza
  DOCUMENTS ||--|{ VERSIONS : conserva
  USERS ||--o{ VERSIONS : carga
  DOCUMENTS ||--o{ REVIEWS : recibe
  USERS ||--o{ REVIEWS : revisa
  USERS ||--o{ SESSIONS : autentica
  USERS ||--o{ ACTIVITY : realiza
  AREAS {
    integer id PK
    string name
  }
  USERS {
    integer id PK
    integer area_id FK
    string name
    string email
    string password
    string role
    integer active
  }
  DOCUMENTS {
    integer id PK
    integer category_id FK
    integer owner_id FK
    integer area_id FK
    string title
    string description
    string visibility
    string academic_year
    string status
    string review_comment
    integer reviewed_by FK
    string filename
    string storage
    integer size
    string created_at
    string updated_at
    integer removed
  }
  VERSIONS {
    integer id PK
    integer document_id FK
    integer number
    string filename
    string storage
    integer size
    string sha256
    string note
    integer created_by FK
    string created_at
  }
  REVIEWS {
    integer id PK
    integer document_id FK
    integer user_id FK
    integer version_number
    string status
    string comment
    string created_at
  }
  CATEGORIES {
    integer id PK
    string name
    string description
  }
  SESSIONS {
    string token PK
    integer user_id FK
    integer expires
  }
  ACTIVITY {
    integer id PK
    integer user_id FK
    string action
    string detail
    string created_at
  }
```

`documents` apunta al archivo actual; `versions` conserva cada carga, incluida la inicial. `(document_id, number)` es único. Una decisión en `reviews` registra el número de versión evaluado. Las decisiones anteriores a la incorporación de ese campo conservan valor nulo, mostrado como «Versión no registrada»; no se inventa el dato histórico.

Los cambios de metadatos, archivos y restauración ponen el estado en Pendiente. La aprobación controla la lectura compartida; propietarios y gestores mantienen acceso operativo. Las áreas son unidades configurables, no un catálogo fijo de carreras.

Las migraciones usan `PRAGMA user_version` y transacciones. El esquema de la primera versión se migra de forma aditiva, con copia previa. La nueva carga escribe un archivo aleatorio y confirma metadatos, versión y auditoría en una transacción; si falla, revierte los registros y retira ese archivo. Los archivos de versiones anteriores son inmutables en las operaciones del sistema.

El respaldo usa `VACUUM INTO`, elimina sesiones de la instantánea y recoge archivos sin intercalar otras solicitudes en el mismo proceso. Un bloqueo por carpeta impide otra instancia de esta aplicación. La restauración valida rutas, tamaños, hashes, integridad SQLite, claves foráneas y existencia de archivos referenciados; conserva una copia preventiva y revierte el reemplazo ante errores recuperables. No es una garantía contra un corte de energía durante el reemplazo; para ese escenario se conserva el ZIP preventivo y debe repetirse la recuperación con el servidor detenido.

Las fechas se almacenan en UTC; la interfaz presenta las fechas con la configuración del navegador. La base usa claves foráneas e índices para filtros y versiones. Las sesiones caducan en ocho horas y las contraseñas se derivan con scrypt. Para redes externas debe añadirse HTTPS en la infraestructura.
