# La Rosa de los Vientos
A [Node.js](https://nodejs.org/en/) batch downloader and renamer for the podcast series "La Rosa de los Vientos" in Onda Cero: http://www.ondacero.es/programas/la-rosa-de-los-vientos/. 

Una aplicación para descargar en lote la serie de Podcasts "La Rosa de los Vientos" de nda Cero: http://www.ondacero.es/programas/la-rosa-de-los-vientos/

## Disclaimer
Los podcasts de La Rosa de Los Vientos se encuentran públicamente accesibles desde [la web del programa](http://www.ondacero.es/programas/la-rosa-de-los-vientos/), y se pueden descargar manualmente en los enlaces de descarga directa de cada podcast. Esta aplicación simplemente automatiza el tedioso y paciente proceso de descargar los archivos mp3 uno a uno, con la añadida ventaja de catalogarlos y renombrarlos por fecha, y reescribir las etiquetas id3 de los mp3 ;)

El autor de esta aplicación no se hace responsable del uso que se pueda dar a estos archivos. 

## Instrucciones
* Instala [Node.js](https://nodejs.org/en/) en Win/Mac/Linux.
* Clona este repositorio. Si no eres usuario habitual de .git, simplemente pincha en el botón verde arriba a la derecha de esta página y descárgate la aplicación en un .ZIP. El archivo contiene unos 450 programas con un tamaño aproximado de 40 Gb. Asegurate de descomprimir el archivo ZIP en un unidad con suficiente espacio (HDD portátiles y USB sticks valen también).
* Abre un terminal (o un Command Prompt) en la carpeta descomprimida (por ejemplo `La-Rosa-de-los-Vientos-master`). 
* Instala las dependencias con `npm` (el `$` no hay que teclearlo...):
```
$ npm install
```
* (opcional) Abre el archivo `download.js` con cualquier editor de texto (Notepad, Sublime, Atom...) y configura la aplicación. Si no te sientes muy cómodo programando o no te apetece calentarte la cabeza, puedes saltarte este paso, y la aplicación descagará todos los podcasts a la carpeta `downloads` en el directorio de la aplicación. 
* Inicia la aplicación tecleando en el terminal:
```
$ node download.js
```
A partir de aquí, la aplicación utilizará la base de datos del archivo y se descargará todos los podcasts uno a uno, renombrándolos y aplicando tags a los mp3 ;)

## Updates
Esta aplicación descarga los archivos utilizando una base de datos local en forma de archivo json, parseada de la web del programa. Si dicha base de datos no está actualizada, y no estás descargando los podcasts más recientes, puedes actualizarla manualmente ejecutando el siguiente script antes de comenzar las descargas:
```
$ node parse.js
```

## Troubleshooting
Cualquier duda/problema/sugerencia puede ser reportada en el apartado 'issues' de este repositorio. 