import yaml
import sys

def modify_compose():
    with open('docker-compose.yml', 'r') as f:
        data = yaml.safe_load(f)

    # Remove old postgres
    if 'postgres' in data['services']:
        del data['services']['postgres']

    # Remove old postgres volume
    if 'postgres_data' in data['volumes']:
        del data['volumes']['postgres_data']

    # Define databases
    databases = {
        'auth': {'port': 5431, 'db': 'auth_db', 'schema': 'auth_service'},
        'finance': {'port': 5432, 'db': 'finance_db', 'schema': 'finance_service'},
        'notifications': {'port': 5433, 'db': 'notifications_db', 'schema': 'notifications_service'},
        'ai': {'port': 5434, 'db': 'ai_db', 'schema': 'ai_service'},
        'planning': {'port': 5435, 'db': 'planning_db', 'schema': 'planning_service'},
        'recurring': {'port': 5436, 'db': 'recurring_db', 'schema': 'recurring_service'}
    }

    # Add new postgres services and volumes
    for name, info in databases.items():
        svc_name = f"{name}-postgres"
        data['services'][svc_name] = {
            'image': 'postgres:16-alpine',
            'container_name': f"finance-{name}-postgres",
            'environment': {
                'POSTGRES_DB': info['db'],
                'POSTGRES_USER': 'finance_user',
                'POSTGRES_PASSWORD': 'finance_pass',
                'DB_SCHEMA': info['schema']
            },
            'ports': [f"{info['port']}:5432"],
            'volumes': [
                f"{name}_postgres_data:/var/lib/postgresql/data",
                "./docker/postgres/init-micro.sh:/docker-entrypoint-initdb.d/01-init-micro.sh"
            ],
            'healthcheck': {
                'test': ["CMD-SHELL", f"pg_isready -U finance_user -d {info['db']}"],
                'interval': '5s',
                'timeout': '5s',
                'retries': 20
            }
        }
        data['volumes'][f"{name}_postgres_data"] = None

    # Update dependencies and environment variables for services
    for svc, cfg in data['services'].items():
        if 'depends_on' in cfg:
            if isinstance(cfg['depends_on'], dict) and 'postgres' in cfg['depends_on']:
                del cfg['depends_on']['postgres']
                # Add specific dependency based on service name
                db_svc_name = None
                if svc == 'api' or svc == 'seed':
                    db_svc_name = 'finance-postgres' # Main ones
                elif svc in databases:
                    db_svc_name = f"{svc}-postgres"
                elif svc == 'notifications-worker':
                    db_svc_name = 'notifications-postgres'
                
                if db_svc_name:
                    cfg['depends_on'][db_svc_name] = {'condition': 'service_healthy'}

        if 'environment' in cfg:
            env = cfg['environment']
            if isinstance(env, list):
                # environment as list of strings
                new_env = []
                for e in env:
                    if e.startswith('DB_URL='):
                        if svc == 'auth':
                            new_env.append(f"DB_URL=${{AUTH_DB_URL:-postgresql://finance_user:finance_pass@auth-postgres:5432/auth_db}}")
                        elif svc == 'finance':
                            new_env.append(f"DB_URL=${{FINANCE_DB_URL:-postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db}}")
                        elif svc == 'planning':
                            new_env.append(f"DB_URL=${{PLANNING_DB_URL:-postgresql://finance_user:finance_pass@planning-postgres:5432/planning_db}}")
                        elif svc == 'recurring':
                            new_env.append(f"DB_URL=${{RECURRING_DB_URL:-postgresql://finance_user:finance_pass@recurring-postgres:5432/recurring_db}}")
                        elif svc == 'notifications' or svc == 'notifications-worker':
                            new_env.append(f"DB_URL=${{NOTIFICATIONS_DB_URL:-postgresql://finance_user:finance_pass@notifications-postgres:5432/notifications_db}}")
                        elif svc == 'ai':
                            new_env.append(f"DB_URL=${{AI_DB_URL:-postgresql://finance_user:finance_pass@ai-postgres:5432/ai_db}}")
                        else:
                            new_env.append(e)
                    else:
                        new_env.append(e)
                cfg['environment'] = new_env
            elif isinstance(env, dict):
                # environment as dict
                if 'DB_URL' in env:
                    if svc == 'api' or svc == 'seed':
                        env['DB_URL'] = 'postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db'

    with open('docker-compose.yml', 'w') as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

def modify_env():
    import re
    # Update .env
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            env_data = f.read()
        
        # We use the internal container names and port 5432 for the services themselves
        # The user will still connect via localhost:5431-5436 from their host machine.
        new_urls = (
            'DB_URL=postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db\n'
            'AUTH_DB_URL=postgresql://finance_user:finance_pass@auth-postgres:5432/auth_db\n'
            'FINANCE_DB_URL=postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db\n'
            'NOTIFICATIONS_DB_URL=postgresql://finance_user:finance_pass@notifications-postgres:5432/notifications_db\n'
            'AI_DB_URL=postgresql://finance_user:finance_pass@ai-postgres:5432/ai_db\n'
            'PLANNING_DB_URL=postgresql://finance_user:finance_pass@planning-postgres:5432/planning_db\n'
            'RECURRING_DB_URL=postgresql://finance_user:finance_pass@recurring-postgres:5432/recurring_db'
        )
        env_data = re.sub(r'DB_URL=.*', new_urls, env_data)
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_data)
    except FileNotFoundError:
        pass

    # Update .env.example
    try:
        with open('.env.example', 'r', encoding='utf-8') as f:
            env_example_data = f.read()
        
        new_urls = (
            'DB_URL=postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db\n'
            'AUTH_DB_URL=postgresql://finance_user:finance_pass@auth-postgres:5432/auth_db\n'
            'FINANCE_DB_URL=postgresql://finance_user:finance_pass@finance-postgres:5432/finance_db\n'
            'NOTIFICATIONS_DB_URL=postgresql://finance_user:finance_pass@notifications-postgres:5432/notifications_db\n'
            'AI_DB_URL=postgresql://finance_user:finance_pass@ai-postgres:5432/ai_db\n'
            'PLANNING_DB_URL=postgresql://finance_user:finance_pass@planning-postgres:5432/planning_db\n'
            'RECURRING_DB_URL=postgresql://finance_user:finance_pass@recurring-postgres:5432/recurring_db'
        )
        env_example_data = re.sub(r'DB_URL=.*', new_urls, env_example_data)
        with open('.env.example', 'w', encoding='utf-8') as f:
            f.write(env_example_data)
    except FileNotFoundError:
        pass

if __name__ == "__main__":
    modify_compose()
    modify_env()
    print("Migration script completed.")
