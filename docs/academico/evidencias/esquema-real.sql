PRAGMA foreign_keys=ON;

CREATE TABLE areas(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL);

CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER DEFAULT 1, area_id INTEGER REFERENCES areas(id));

CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,description TEXT DEFAULT '');

CREATE TABLE documents(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT,category_id INTEGER REFERENCES categories(id),owner_id INTEGER REFERENCES users(id),visibility TEXT NOT NULL,filename TEXT NOT NULL,storage TEXT NOT NULL,size INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,removed INTEGER DEFAULT 0, area_id INTEGER REFERENCES areas(id), academic_year TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'aprobado', review_comment TEXT DEFAULT '', reviewed_by INTEGER REFERENCES users(id));

CREATE TABLE versions(id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES documents(id),number INTEGER NOT NULL,filename TEXT NOT NULL,storage TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,note TEXT DEFAULT '',created_by INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(document_id,number));

CREATE TABLE reviews(id INTEGER PRIMARY KEY,document_id INTEGER REFERENCES documents(id),user_id INTEGER REFERENCES users(id),status TEXT NOT NULL,comment TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP, version_number INTEGER);

CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);

CREATE TABLE activity(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),action TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);


CREATE INDEX document_filter ON documents(removed,area_id,status,created_at);
CREATE INDEX versions_document ON versions(document_id);
PRAGMA user_version=3;
