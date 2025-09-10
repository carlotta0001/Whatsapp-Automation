# Overview

This is a WhatsApp bot application built with Baileys library that supports multi-device authentication using pairing codes. The bot is designed to manage multiple WhatsApp sessions simultaneously, with each phone number maintaining its own session state and authentication credentials. The application focuses on establishing and maintaining persistent connections to WhatsApp's multi-device API without requiring QR code scanning.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework
- **Runtime**: Node.js application using the Baileys library (@whiskeysockets/baileys) for WhatsApp Web API integration
- **Authentication**: Multi-file auth state management with pairing code authentication instead of QR scanning
- **Session Management**: Individual session directories for each phone number to maintain separate authentication states

## Connection Management
- **Multi-Session Architecture**: Concurrent connections for multiple phone numbers defined in numbers.json configuration
- **Reconnection Logic**: Automatic reconnection handling with proper disconnect reason checking
- **Session Persistence**: File-based session storage in dedicated directories per phone number

## Authentication Flow
- **Pairing Code Method**: Uses requestPairingCode() for device linking instead of QR codes
- **Credential Storage**: Multi-file auth state with automatic credential saving on updates
- **Session Isolation**: Each phone number maintains independent authentication and session data

## Logging and Monitoring
- **Silent Logging**: Pino logger configured to silent level to reduce console noise
- **Connection Events**: Event-driven architecture for monitoring connection status and credential updates
- **Error Handling**: Structured error handling for connection failures and authentication issues

## File Structure
- **Session Storage**: Organized session data in `/sessions/{phoneNumber}/` directories
- **Configuration**: JSON-based phone number configuration in numbers.json
- **Credential Management**: Separate credential files including pre-keys, app-state sync data, and session information

# External Dependencies

## Primary Libraries
- **@whiskeysockets/baileys**: WhatsApp Web API client library for multi-device support
- **pino**: Fast JSON logger with configurable log levels

## Authentication Dependencies
- **Multi-file Auth State**: Built-in Baileys authentication state management
- **Session Persistence**: File system-based session storage using Node.js fs module

## WhatsApp Integration
- **WhatsApp Multi-Device API**: Direct integration with WhatsApp's official multi-device protocol
- **Browser Emulation**: Uses Ubuntu Chrome browser identification for connection establishment
- **Pairing Code Authentication**: Alternative to QR code scanning for device registration