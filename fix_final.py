import yaml
import os

# Let's try to load it. If it fails, we use the reconstruction script which is safe.
try:
    with open('docker-compose.yml', 'r') as f:
        # We can't safe_load if it's broken.
        # Let's just use the reconstruction script but with the Apache Kafka image.
        pass
except:
    pass

# Re-run reconstruction with fix for Apache Kafka
import yaml

file_path = "docker-compose.yml"
# We'll use the monolith as a base again to be sure
os.system("git restore docker-compose.yml")

with open('docker-compose.yml', 'r') as f:
    compose = yaml.safe_load(f)

# Add all microservices
compose['services']['gateway'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-gateway',
    'env_file': ['.env'],
    'environment': [
        'AUTH_SERVICE_URL=http://auth:8000',
        'FINANCE_SERVICE_URL=http://finance:8000',
        'NOTIFICATIONS_SERVICE_URL=http://notifications:8000',
        'AI_SERVICE_URL=http://ai:8000'
    ],
    'command': ['uvicorn', 'app.gateway_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8005:8000'],
    'depends_on': {
        'auth': {'condition': 'service_started'},
        'finance': {'condition': 'service_started'},
        'notifications': {'condition': 'service_started'},
        'notifications-worker': {'condition': 'service_started'},
        'ai': {'condition': 'service_started'},
        'planning': {'condition': 'service_started'},
        'recurring': {'condition': 'service_started'}
    },
    'profiles': ['micro']
}

compose['services']['auth'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-auth',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${AUTH_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/auth_db}',
        'DB_SCHEMA=${AUTH_DB_SCHEMA:-auth_service}'
    ],
    'command': ['uvicorn', 'app.services.auth_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8001:8000'],
    'depends_on': {'postgres': {'condition': 'service_healthy'}},
    'profiles': ['micro']
}

compose['services']['finance'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-finance',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${FINANCE_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/finance_db}',
        'DB_SCHEMA=${FINANCE_DB_SCHEMA:-finance_service}'
    ],
    'command': ['uvicorn', 'app.services.finance_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8002:8000'],
    'depends_on': {'postgres': {'condition': 'service_healthy'}},
    'profiles': ['micro']
}

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

compose['services']['notifications'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-notifications',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${NOTIFICATIONS_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/notifications_db}',
        'DB_SCHEMA=${NOTIFICATIONS_DB_SCHEMA:-notifications_service}',
        'REDIS_URL=${REDIS_URL:-redis://redis:6379/0}'
    ],
    'command': ['uvicorn', 'app.services.notifications_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8003:8000'],
    'depends_on': {
        'postgres': {'condition': 'service_healthy'},
        'redis': {'condition': 'service_started'}
    },
    'profiles': ['micro']
}

compose['services']['notifications-worker'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-notifications-worker',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${NOTIFICATIONS_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/notifications_db}',
        'DB_SCHEMA=${NOTIFICATIONS_DB_SCHEMA:-notifications_service}',
        'REDIS_URL=${REDIS_URL:-redis://redis:6379/0}'
    ],
    'command': ['python', '-m', 'app.workers.notifications_worker'],
    'depends_on': {
        'postgres': {'condition': 'service_healthy'},
        'redis': {'condition': 'service_started'}
    },
    'profiles': ['micro']
}

compose['services']['ai'] = {
    'build': {'context': '.', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-ai',
    'env_file': ['.env'],
    'environment': [
        'DB_URL=${AI_DB_URL:-postgresql://finance_user:finance_pass@postgres:5432/finance_db}',
        'DB_SCHEMA=${AI_DB_SCHEMA:-finance_service}'
    ],
    'command': ['uvicorn', 'app.services.ai_main:app', '--host', '0.0.0.0', '--port', '8000'],
    'ports': ['8004:8000'],
    'depends_on': {'postgres': {'condition': 'service_healthy'}},
    'profiles': ['micro']
}

# Add Redis
compose['services']['redis'] = {
    'image': 'redis:7-alpine',
    'container_name': 'finance-redis',
    'ports': ['6379:6379'],
    'volumes': ['redis_data:/data']
}

# Add Kafka (Apache image as requested by user)
compose['services']['kafka'] = {
    'image': 'apache/kafka:3.7.0',
    'container_name': 'finance-kafka',
    'ports': ['9092:9092'],
    'environment': {
        'KAFKA_NODE_ID': 1,
        'KAFKA_PROCESS_ROLES': 'broker,controller',
        'KAFKA_LISTENERS': 'PLAINTEXT://:9092,CONTROLLER://:9093',
        'KAFKA_ADVERTISED_LISTENERS': 'PLAINTEXT://kafka:9092',
        'KAFKA_CONTROLLER_LISTENER_NAMES': 'CONTROLLER',
        'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP': 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
        'KAFKA_CONTROLLER_QUORUM_VOTERS': '1@kafka:9093',
        'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR': 1
    },
    'volumes': ['kafka_data:/tmp/kraft-combined-logs'],
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

# Add Frontend
compose['services']['frontend'] = {
    'build': {'context': './frontend', 'dockerfile': 'Dockerfile'},
    'container_name': 'finance-frontend',
    'ports': ['5173:5173'],
    'volumes': ['./frontend:/app', '/app/node_modules'],
    'environment': ['VITE_API_URL=http://localhost:8005/api/v1'],
    'depends_on': ['gateway'],
    'profiles': ['micro']
}

# Add Volumes
if 'volumes' not in compose or not compose['volumes']:
    compose['volumes'] = {}
compose['volumes']['kafka_data'] = None
compose['volumes']['redis_data'] = None

# Add Postgres init script mapping if missing
pg_volumes = compose['services']['postgres'].get('volumes', [])
if not any('init-micro.sh' in v for v in pg_volumes):
    compose['services']['postgres']['volumes'].append('./docker/postgres/init-micro.sh:/docker-entrypoint-initdb.d/01-init-micro.sh')

with open('docker-compose.yml', 'w') as f:
    yaml.dump(compose, f, sort_keys=False, default_flow_style=False)
