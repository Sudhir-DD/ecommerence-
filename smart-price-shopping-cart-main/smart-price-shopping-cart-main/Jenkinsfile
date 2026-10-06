pipeline {
    agent any

    environment {
        IMAGE_NAME = 'shopping-cart'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
            }
        }
    }

    post {
        success {
            echo "Built ${IMAGE_NAME}:${BUILD_NUMBER}"
        }
        failure {
            echo 'Build failed.'
        }
    }
}
