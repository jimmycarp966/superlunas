# Integración automática de PR

La política de `.github/auto-merge/config.json` se ejecuta con GitHub Actions y su
token temporal de este repositorio. No usa tokens personales ni secretos de la
aplicación para decidir un merge.

## Qué se integra

- PR de `jimmycarp966`: automáticamente cuando sale de borrador, apunta a la rama
  principal, no tiene conflictos y todos los controles configurados pasan.
- PR de Mily (`siriusdevs96`) o de otro colaborador: además necesitan la revisión
  **Approve** de Daniel sobre el último commit. Un commit nuevo invalida esa
  revisión. Una solicitud de cambios de Daniel bloquea la integración.
- PR desde forks: quedan para integración manual.
- Ningún PR pasa por tener cero controles: `Controles para merge / Validar PR`
  es obligatorio. Los controles externos configurados también deben existir y
  pasar, y cualquier otro control pendiente o fallido detiene el merge.

El control técnico usa las pruebas de esta política, revisa el diff y la sintaxis
de scripts; cuando cambia la aplicación ejecuta el control de tipos o comando
definido para este proyecto. No ejecuta bases productivas. Un cambio limitado a
documentación o automatización evita instalar la aplicación completa.

## Aprobar SQL

Toda modificación, eliminación o renombrado de SQL o migraciones espera un
comentario **nuevo**, escrito por Daniel en el PR:

```text
/aprobar-sql SHA_COMPLETO_DE_40_CARACTERES
```

El check «Política de merge» muestra el comando con el SHA real. Se puede revocar
con `/revocar-sql SHA_COMPLETO_DE_40_CARACTERES`. Los comentarios editados no se
aceptan; borrar el comentario de aprobación elimina esa autorización. Una
revisión general del PR no reemplaza esta aprobación de SQL.

Se pide autorización para todo SQL porque una función o SQL dinámico puede
cambiar datos aunque el texto no contenga un `UPDATE` evidente. Esto no ejecuta
SQL por sí mismo: solo autoriza integrar exactamente ese commit.

## Publicación y recuperación

El merge conserva los commits originales. Las integraciones externas, como
Vercel, reciben el cambio por Git. GitHub no dispara otros workflows de `push`
cuando el merge lo hace `GITHUB_TOKEN`; por eso la política despacha
explícitamente los workflows de publicación configurados.

En proyectos con migraciones, el despacho incluye el PR, el SHA del merge y la
lista exacta de migraciones autorizadas. El ejecutor comprueba esos datos y se
detiene antes de escribir si encuentra otros pendientes. El estado del merge y
el resultado de las migraciones son verificaciones independientes.

Si falla el despacho después del merge, ejecutar **Merge automático con
revisión** desde Actions con `pull_request_number` y `release_only=true`.
Esta recuperación solo la puede solicitar Daniel y vuelve a validar controles
y aprobaciones. Si el workflow SQL llegó a ejecutarse y falló, revisar su error
antes de reintentarlo; su ledger y concurrencia siguen vigentes.

Para pausar los merges automáticos, establecer la variable del repositorio
`AUTO_MERGE_PAUSED=true`. Para reanudar, quitarla o ponerla en `false`.

## Límites y permisos

El evaluador carga exclusivamente su código desde la rama principal. No instala
dependencias del PR ni ejecuta su código con permisos de escritura. Las pruebas
del PR corren aparte, con token de lectura y sin secretos de producción.

En repositorios privados con GitHub Free esta política controla los merges que
realiza Actions; **no puede impedir un push o merge manual de una persona con
permiso de escritura**. No modifica los permisos de los colaboradores. Para
imponer también esa barrera hacen falta las protecciones de rama del plan
correspondiente.

La instalación es por repositorio: los proyectos nuevos deben recibir estos
archivos y su configuración. No se incluyen repositorios archivados, forks ni
respaldos de migración.
