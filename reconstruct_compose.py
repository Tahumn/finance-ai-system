import yaml
import os

os.system("git restore docker-compose.yml")

with open('docker-compose.yml', 'r') as f:
    compose = yaml.safe_load(f)

# 1. Update Gateway
gateway = compose['services']['gateway']
gateway['depends_on']['planning'] = {'condition': 'service_started'}
gateway['depends_on']['recurring'] = {'condition': 'service_started'}

# 2. Add Planning service
compose['services']['planning'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-planning',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${PLANNING_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/planning_db}',
        'DB_SCHEMA=${PLANNING_DB_SCHEMA:-planning_service}'
    ],
    'command': ['uvicorn', 'app.services.planning_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8006:8000'],
    'depends_on': {'postgres': {'condition': 'service_healthy'}},
    'profiles': ['micro']
}

# 3. Add Recurring service
compose['services']['recurring'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-recurring',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${RECURRING_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/recurring_db}',
        'DB_SCHEMA=${RECURRING_DB_SCHEMA:-recurring_service}'
    ],
    'command': ['uvicorn', 'app.services.recurring_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8007:8000'],
    'depends_on': {'postgres': {'condition': 'service_healthy'}},
    'profiles': ['micro']
}

# 4. Add Kafka
compose['services']['kafka'] = {
    'image': 'bitnami/kafka:3.5',
    'container_name': 'finance-kafka',
    'ports': ['9092:9092'],
    'environment': [
        'KAFKA_ENABLE_KRAFT=yes',
        'KAFKA_CFG_PROCESS_ROLES=broker,controller',
        'KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER',
        'KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093',
        'KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
        'KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092',
        'KAFKA_CFG_BROKER_ID=1',
        'KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=1@kafka:9093',
        'ALLOW_PLAINTEXT_LISTENER=yes',
        'KAFKA_CFG_NODE_ID=1'
    ],
    'volumes': ['kafka_data:/bitnami/kafka'],
    'profiles': ['micro']
}

compose['services']['kafka-ui'] = {
    'image': 'provectuslabs/kafka-ui:latest',
    'container_name': 'finance-kafka-ui',
    'ports': ['8080:8080'],
    'environment': [
        'KAFKA_CLUSTERS_0_NAME=local',
        'KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092'
    ],
    'depends_on': ['kafka'],
    'profiles': ['micro']
}

# 5. Add Frontend
compose['services']['frontend'] = {
    'build': {'context': './frontend', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-frontend',
    'ports': ['5173:5173'],
    'volumes': ['./frontend:/app', '/app/node_modules'],
    'environment': ['VITE_API_URL=http://localhost:8005/api/v1'],
    'depends_on': ['gateway'],
    'profiles': ['micro']
}

# 6. Add Volume
if 'volumes' not in compose:
    compose['volumes'] = {}
compose['volumes']['kafka_data'] = None

with open('docker-compose.yml', 'w') as f:
    yaml.dump(compose, f, sort_keys=False, default_flow_style=False)
