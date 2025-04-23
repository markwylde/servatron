#!/usr/bin/env sh
mkdir -p defaultCerts
openssl genrsa -out defaultCerts/key.pem
openssl req -newkey rsa:2048 -nodes -keyout defaultCerts/key.pem -x509 -days 3650 -out defaultCerts/cert.pem -subj "/C=GB/ST=London/L=London/O=Local Development/OU=IT Department/CN=localhost"