import os, sys
import json
import webapp2
from subprocess import Popen, PIPE, STDOUT
import hashlib
import time

# Some constants
SUCCESS_MESSAGE = """
<b>Request complete.</b><br>You can download your data here:
<a href="{link}" target="_blank">clipped.tif</a>
"""
TIMEOUT_MESSAGE = """
Your request is taking longer than expected. You can follow the status of your request here:
<a href="{link}" target="_blank">Request Status</a>
"""

URL_BASE = 'http://ltweb.ceoas.oregonstate.edu/mapping/'
REQUEST_PATH = '/mapping/requestData/';          # where this webapp is mounted / virtual hosted
FULL_APP_PATH = '/var/www/html/mapping/'

# WebApp2 servlet to handle requests for timeseries over the patch data
class DataHandler(webapp2.RequestHandler):
    def get(self, path=''):
        # params keep both GET and POST values
        GET = self.request.params
        message = processRequest(GET)
        self.response.write(message)

    # Do same thing on GET and POST methods
    def post(self, path=''):
        self.get(path)

# Initialize the webapp handlers.
application = webapp2.WSGIApplication([
    (REQUEST_PATH, DataHandler),
], debug=True)


COMMAND = """
timeout 30m /usr/lib/anaconda/bin/gdalwarp --config GDAL_DATA /usr/lib/anaconda/share/gdal -of GTiff -tap -tr {res} {res} -r near -crop_to_cutline -cutline {bounds_file} {in_map} {out_map}
"""
def processRequest(data):

    # Mostly unused, but a reminder of what's being sent.
    name = data['req-name']
    email = data['req-email']
    resolution = int(data['req-resolution'])
    layer = data['layer']

    map_fn = FULL_APP_PATH + '/maps/{0}/map.tif'.format(data['layer'])
    # Validate that Layer exists
    if not os.path.isfile(map_fn):
        return "Invalid Map Request"

    # Derive a unique-ish name to use a location to store the results
    p = data['geoJSON'] + data['layer'] + data['req-resolution'] + data['req-email']
    hash = hashlib.md5(p).hexdigest()
    request_name = data['layer']+'_'+hash[:8]

    outpath = FULL_APP_PATH + 'results/'+ request_name
    if not os.path.exists(outpath):
        os.makedirs(outpath)

    # write the geoJSON to a file so gdalwarp can read it in
    geo_fn = outpath+'/mask.json'
    with open(geo_fn, 'w+') as f:
        f.write(data['geoJSON'])

    # The replaces give some protection against maliciously formed input
    out_map = outpath+'/clipped.tif'
    map_link = URL_BASE + 'results/' + request_name + '/clipped.tif'

    # Build the gdalwarp command
    job = COMMAND.format(res=resolution, bounds_file=geo_fn, in_map=map_fn, out_map=out_map)
    job = job.replace(';', '').replace("\n", '')

    # Make a status report file and pipe gdalwarp output there
    out_file = open(outpath+'/status.txt', 'w+')
    out_file.write("{0}: {1}\n".format(name, email))
    out_file.flush()
    proc = Popen(job.split(), stdout=out_file, stderr=out_file)

    # Wait 30 seconds for the clipping to be complete. Most are done in under 5.
    for i in xrange(30):
        if proc.poll() == None:
            time.sleep(1)
        else:
            # It's complete! Send out a success message linking to the map
            if os.path.isfile(out_map):
                return SUCCESS_MESSAGE.format(link=map_link, status=proc.poll())
            else:
                return "An unknown error occurred while extracting data."

    # This is taking awhile. Send a message linking to the status report page
    request_link = URL_BASE + 'results.php?r='+request_name
    return TIMEOUT_MESSAGE.format(link=request_link)
